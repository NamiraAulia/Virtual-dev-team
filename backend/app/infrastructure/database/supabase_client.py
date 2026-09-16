from __future__ import annotations

"""
Supabase Client.

Thin CRUD wrapper over the Supabase Python SDK for the three core tables:
  - tasks
  - patches
  - task_logs
"""

import logging
from datetime import datetime, timezone

# pyrefly: ignore [missing-import]
from supabase import Client, create_client

from app.domain.patch import PatchAction, PatchRecord
from app.domain.task import TaskCreate, TaskRecord, TaskStatus
from app.domain.task_log import TaskLogEntry

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Wrapper for Supabase database operations."""

    def __init__(self, url: str, key: str) -> None:
        self._client: Client = create_client(url, key)

    def create_task(self, task: TaskCreate) -> TaskRecord:
        """Insert a new task and return the created record."""
        now = datetime.now(timezone.utc).isoformat()
        data = {
            "title": task.title,
            "description": task.description,
            "repo_full_name": task.repo_full_name,
            "status": TaskStatus.PENDING.value,
            "created_at": now,
            "updated_at": now,
        }
        result = self._client.table("tasks").insert(data).execute()
        if not result.data or len(result.data) == 0:
            logger.error("Supabase create_task failed to return created row data")
            raise RuntimeError("Database insertion failed: empty record returned from Supabase")
        row = result.data[0]
        logger.info("Created task id=%s title='%s'", row["id"], row["title"])
        return TaskRecord(**row)

    def get_task(self, task_id: str) -> TaskRecord | None:
        """Fetch a single task by ID. Returns None if not found."""
        result = (
            self._client.table("tasks")
            .select("*")
            .eq("id", task_id)
            .execute()
        )
        if not result.data or len(result.data) == 0:
            return None
        return TaskRecord(**result.data[0])

    def list_tasks(self) -> list[TaskRecord]:
        """Fetch all tasks ordered by creation date (newest first)."""
        result = (
            self._client.table("tasks")
            .select("*")
            .order("created_at", desc=True)
            .execute()
        )
        return [TaskRecord(**row) for row in (result.data or [])]

    def update_task_status(self, task_id: str, status: TaskStatus) -> TaskRecord | None:
        """Update a task's status and return the updated record."""
        now = datetime.now(timezone.utc).isoformat()
        result = (
            self._client.table("tasks")
            .update({"status": status.value, "updated_at": now})
            .eq("id", task_id)
            .execute()
        )
        if not result.data or len(result.data) == 0:
            logger.warning("update_task_status for task_id=%s returned empty data", task_id)
            return self.get_task(task_id)
        logger.info("Updated task id=%s status=%s", task_id, status.value)
        return TaskRecord(**result.data[0])

    def save_patches(self, patches: list[PatchAction], task_id: str) -> list[PatchRecord]:
        """Insert a batch of patch actions for a task."""
        now = datetime.now(timezone.utc).isoformat()
        rows = [
            {
                "task_id": task_id,
                "file_path": p.file_path,
                "search_block": p.search_block,
                "replace_block": p.replace_block,
                "explanation": p.explanation,
                "status": "pending",
                "created_at": now,
            }
            for p in patches
        ]
        result = self._client.table("patches").insert(rows).execute()
        logger.info("Saved %d patches for task_id=%s", len(result.data), task_id)
        return [PatchRecord(**row) for row in result.data]

    def get_patches_by_task(self, task_id: str) -> list[PatchRecord]:
        """Fetch all patches for a given task."""
        result = (
            self._client.table("patches")
            .select("*")
            .eq("task_id", task_id)
            .order("created_at")
            .execute()
        )
        return [PatchRecord(**row) for row in result.data]

    def update_patch_status(self, patch_id: str, status: str) -> PatchRecord | None:
        """Update a single patch's status (pending → approved | rejected)."""
        result = (
            self._client.table("patches")
            .update({"status": status})
            .eq("id", patch_id)
            .execute()
        )
        if not result.data:
            return None
        return PatchRecord(**result.data[0])

    def append_log(self, entry: TaskLogEntry) -> None:
        """Insert a single audit log entry."""
        data = {
            "task_id": entry.task_id,
            "step_number": entry.step_number,
            "tool_name": entry.tool_name,
            "tool_input": entry.tool_input,
            "tool_output": entry.tool_output,
            "created_at": entry.created_at.isoformat(),
        }
        self._client.table("task_logs").insert(data).execute()

    def get_logs_by_task(self, task_id: str) -> list[TaskLogEntry]:
        """Fetch all log entries for a task, ordered by step number."""
        result = (
            self._client.table("task_logs")
            .select("*")
            .eq("task_id", task_id)
            .order("step_number")
            .execute()
        )
        return [TaskLogEntry(**row) for row in result.data]
