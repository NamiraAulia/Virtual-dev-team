import unittest
from unittest.mock import MagicMock, patch
from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app
from app.domain.task import TaskRecord, TaskStatus
from app.presentation.api_v1.webhooks.sentry import get_db

client = TestClient(app)


class TestSentryWebhook(unittest.TestCase):
    def setUp(self):
        self.mock_db = MagicMock()
        app.dependency_overrides[get_db] = lambda: self.mock_db

    def tearDown(self):
        app.dependency_overrides.clear()

    @patch("app.presentation.api_v1.webhooks.sentry.task_queue")
    def test_handle_sentry_webhook_success(self, mock_queue):
        self.mock_db.list_tasks.return_value = []

        now = datetime.now(timezone.utc)
        mock_task = TaskRecord(
            id="task-12345",
            title="TypeError: Cannot read properties of undefined (reading 'avatar')",
            description="Sentry Error Details",
            repo_full_name="acme-org/frontend-app",
            status=TaskStatus.PENDING,
            created_at=now,
            updated_at=now,
        )
        self.mock_db.create_task.return_value = mock_task

        async def dummy_enqueue(task_id):
            pass

        mock_queue.enqueue.side_effect = dummy_enqueue

        payload = {
            "event": {
                "title": "TypeError: Cannot read properties of undefined (reading 'avatar')",
                "culprit": "src/components/UserProfileCard.tsx:42",
                "location": "src/components/UserProfileCard.tsx:42",
            },
            "project_slug": "acme-org/frontend-app",
        }

        response = client.post("/api/v1/webhooks/sentry", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], "created")
        self.assertEqual(data["task_id"], "task-12345")
        self.mock_db.create_task.assert_called_once()

    @patch("app.presentation.api_v1.webhooks.sentry.task_queue")
    def test_handle_sentry_webhook_deduplication(self, mock_queue):
        now = datetime.now(timezone.utc)
        existing_task = TaskRecord(
            id="existing-task-999",
            title="TypeError: Cannot read properties of undefined (reading 'avatar')",
            description="Existing Task",
            repo_full_name="acme-org/frontend-app",
            status=TaskStatus.PENDING,
            created_at=now,
            updated_at=now,
        )
        self.mock_db.list_tasks.return_value = [existing_task]

        payload = {
            "event": {
                "title": "TypeError: Cannot read properties of undefined (reading 'avatar')",
                "culprit": "src/components/UserProfileCard.tsx:42",
            }
        }

        response = client.post("/api/v1/webhooks/sentry", json=payload)

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], "skipped")
        self.assertIn("Task already exists", data["message"])
        self.mock_db.create_task.assert_not_called()


if __name__ == "__main__":
    unittest.main()
