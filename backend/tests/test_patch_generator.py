import unittest
from unittest.mock import AsyncMock, MagicMock
from datetime import datetime, timezone

from app.config import Settings
from app.domain.task import TaskRecord, TaskStatus
from app.domain.patch import PatchSet, PatchProposal
from app.use_cases.patch_generator import (
    PatchGeneratorUseCase,
    TaskNotFoundError,
    InvalidTaskStatusError,
    ExplorationExecutionError,
)


class TestPatchGeneratorUseCase(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        self.mock_settings = Settings(
            google_generative_ai_api_key="test-api-key",
            github_personal_access_token="test-gh-token",
            supabase_url="https://dummy.supabase.co",
            supabase_service_role_key="test-key",
            target_repo="owner/repo",
        )

        self.sample_task = TaskRecord(
            id="task-uuid-1234",
            title="Fix bug in auth service",
            description="Null pointer exception on login",
            repo_full_name="owner/repo",
            status=TaskStatus.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

        self.exploring_task = self.sample_task.model_copy(update={"status": TaskStatus.EXPLORING})
        self.ready_task = self.sample_task.model_copy(update={"status": TaskStatus.PATCH_READY})

        self.mock_patch_set = PatchSet(
            task_id="task-uuid-1234",
            summary="Fixed null check",
            actions=[
                PatchProposal(
                    file_path="auth.py",
                    search_block="if user:",
                    replace_block="if user is not None:",
                    explanation="Fix NoneType comparison",
                )
            ],
        )

    async def test_execute_success_flow(self):
        # Setup mocks
        self.mock_db.get_task.side_effect = [
            self.sample_task,       # Initial fetch before validation
            self.exploring_task,    # After status set to exploring
            self.ready_task,        # Final fetch
        ]
        self.mock_db.update_task_status.return_value = self.ready_task

        mock_engine = MagicMock()
        mock_engine.run_exploration = AsyncMock(return_value=self.mock_patch_set)
        mock_engine_factory = MagicMock(return_value=mock_engine)

        mock_github = MagicMock()
        mock_github_factory = MagicMock(return_value=mock_github)

        use_case = PatchGeneratorUseCase(
            engine_factory=mock_engine_factory,
            github_factory=mock_github_factory,
        )

        updated_task, patch_set = await use_case.execute(
            task_id="task-uuid-1234",
            db=self.mock_db,
            settings=self.mock_settings,
        )

        self.assertEqual(updated_task.status, TaskStatus.PATCH_READY)
        self.assertEqual(len(patch_set.actions), 1)

        # Verify status transitions
        self.mock_db.update_task_status.assert_any_call("task-uuid-1234", TaskStatus.EXPLORING)
        self.mock_db.update_task_status.assert_any_call("task-uuid-1234", TaskStatus.PATCH_READY)

        # Verify patches persisted
        self.mock_db.save_patches.assert_called_once_with(self.mock_patch_set.actions, "task-uuid-1234")

        # Verify engine was invoked with task (status=EXPLORING) and db for audit logging
        mock_engine.run_exploration.assert_called_once_with(self.exploring_task, db=self.mock_db)

    async def test_execute_task_not_found(self):
        self.mock_db.get_task.return_value = None
        use_case = PatchGeneratorUseCase()

        with self.assertRaises(TaskNotFoundError):
            await use_case.execute(
                task_id="non-existent",
                db=self.mock_db,
                settings=self.mock_settings,
            )

    async def test_execute_invalid_status(self):
        running_task = self.sample_task.model_copy(update={"status": TaskStatus.EXPLORING})
        self.mock_db.get_task.return_value = running_task
        use_case = PatchGeneratorUseCase()

        with self.assertRaises(InvalidTaskStatusError):
            await use_case.execute(
                task_id="task-uuid-1234",
                db=self.mock_db,
                settings=self.mock_settings,
            )

    async def test_execute_exploration_failure_reverts_status(self):
        self.mock_db.get_task.return_value = self.sample_task

        mock_engine = MagicMock()
        mock_engine.run_exploration = AsyncMock(side_effect=RuntimeError("AI API quota exceeded"))
        mock_engine_factory = MagicMock(return_value=mock_engine)

        mock_github = MagicMock()
        mock_github_factory = MagicMock(return_value=mock_github)

        use_case = PatchGeneratorUseCase(
            engine_factory=mock_engine_factory,
            github_factory=mock_github_factory,
        )

        with self.assertRaises(ExplorationExecutionError):
            await use_case.execute(
                task_id="task-uuid-1234",
                db=self.mock_db,
                settings=self.mock_settings,
            )

        # Verify task status was reverted to pending
        self.mock_db.update_task_status.assert_any_call("task-uuid-1234", TaskStatus.PENDING)


if __name__ == "__main__":
    unittest.main()
