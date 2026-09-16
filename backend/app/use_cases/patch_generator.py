from __future__ import annotations

"""
Patch Generator Use Case.

Orchestrates the entire autonomous AI exploration and patch generation workflow:
1. Validates task existence and status.
2. Transitions task status to 'exploring'.
3. Invokes GeminiEngine to explore repository via GitHub tools (with automated task_logs recording).
4. Persists the generated patches to Supabase.
5. Transitions task status to 'patch_ready'.
6. Handles graceful recovery/logging on failures.
"""

import logging
from typing import TYPE_CHECKING

from app.domain.patch import PatchSet
from app.domain.task import TaskRecord, TaskStatus
from app.infrastructure.ai.gemini_engine import GeminiEngine
from app.infrastructure.ai.openrouter_engine import OpenRouterEngine
from app.infrastructure.events.event_bus import task_event_bus
from app.infrastructure.github.adapter import GitHubAdapter

if TYPE_CHECKING:
    from app.config import Settings
    from app.infrastructure.database.supabase_client import SupabaseClient

logger = logging.getLogger(__name__)


class TaskNotFoundError(Exception):
    """Raised when task ID does not exist."""
    pass


class InvalidTaskStatusError(Exception):
    """Raised when task is not in a valid status to run exploration."""
    pass


class ExplorationExecutionError(Exception):
    """Raised when autonomous AI exploration fails."""
    pass


class PatchGeneratorUseCase:
    """
    Orchestrator for the autonomous code exploration & patch generation flow.
    """

    def __init__(
        self,
        engine_factory: type[GeminiEngine] = GeminiEngine,
        github_factory: type[GitHubAdapter] = GitHubAdapter,
    ) -> None:
        self._engine_factory = engine_factory
        self._github_factory = github_factory

    async def execute(
        self,
        task_id: str,
        db: SupabaseClient,
        settings: Settings,
        language: str = "en",
        model_name: str | None = None,
    ) -> tuple[TaskRecord, PatchSet]:
        """
        Execute the patch generation use case for a given task.

        Returns:
            tuple[TaskRecord, PatchSet]: The updated task record and the generated PatchSet.
        """
        # 1. Fetch task
        task = db.get_task(task_id)
        if not task:
            logger.error("Use Case: Task id=%s not found", task_id)
            raise TaskNotFoundError(f"Task '{task_id}' not found")

        # 2. Validate status (must be pending)
        if task.status != TaskStatus.PENDING:
            logger.warning(
                "Use Case: Task id=%s is in invalid status '%s' (must be 'pending')",
                task_id,
                task.status.value,
            )
            raise InvalidTaskStatusError(
                f"Task must be in 'pending' status to run. Current status: '{task.status.value}'"
            )

        # 3. Transition status to exploring
        logger.info("Use Case: Transitioning task id=%s to 'exploring'", task_id)
        db.update_task_status(task_id, TaskStatus.EXPLORING)
        task = db.get_task(task_id) or task
        await task_event_bus.publish(task_id, "status_changed", {"status": "exploring"})

        # 4. Run AI Exploration & Persist
        try:
            github_adapter = self._github_factory(
                token=settings.github_personal_access_token,
                repo_full_name=task.repo_full_name,
            )

            # Determine engine based on model name
            is_openrouter_model = bool(model_name and ("/" in model_name or "openrouter" in model_name))
            if is_openrouter_model:
                if not settings.openrouter_api_key:
                    raise ValueError(
                        "OPENROUTER_API_KEY is not set in backend/.env. "
                        "Please add OPENROUTER_API_KEY to use OpenRouter models."
                    )
                engine = OpenRouterEngine(
                    api_key=settings.openrouter_api_key,
                    github_adapter=github_adapter,
                    model_name=model_name,
                )
            else:
                engine = self._engine_factory(
                    api_key=settings.google_generative_ai_api_key,
                    github_adapter=github_adapter,
                    model_name=model_name or getattr(settings, "gemini_model", None),
                )

            logger.info(
                "Use Case: Running AI exploration for task id=%s (engine=%s, language=%s, model=%s)",
                task_id,
                type(engine).__name__,
                language,
                engine.model_name,
            )
            # engine.run_exploration automatically writes audit logs to db if db is provided
            patch_set = await engine.run_exploration(task, db=db, language=language)

            # 5. Persist patches
            logger.info("Use Case: Persisting %d patches for task id=%s", len(patch_set.actions), task_id)
            db.save_patches(patch_set.actions, task_id)

            # 6. Transition status to patch_ready
            updated_task = db.update_task_status(task_id, TaskStatus.PATCH_READY)
            logger.info("Use Case: Task id=%s is now 'patch_ready'", task_id)
            await task_event_bus.publish(
                task_id,
                "patch_ready",
                {
                    "status": "patch_ready",
                    "task_id": task_id,
                    "patches_count": len(patch_set.actions),
                    "summary": patch_set.summary,
                },
            )
            return (updated_task or task, patch_set)

        except Exception as err:
            logger.error("Use Case: Exploration failed for task id=%s: %s", task_id, err, exc_info=True)
            # Revert status back to pending
            try:
                db.update_task_status(task_id, TaskStatus.PENDING)
                await task_event_bus.publish(
                    task_id,
                    "exploration_failed",
                    {"status": "pending", "error": str(err)},
                )
            except Exception as revert_err:
                logger.error("Use Case: Failed to revert task status: %s", revert_err)

            raise ExplorationExecutionError(f"Autonomous AI exploration failed: {err}") from err
