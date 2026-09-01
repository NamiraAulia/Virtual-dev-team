"""
Task domain models.

Defines the data shapes for task creation (input), task records (DB row),
and the task lifecycle status enum.
"""

from datetime import datetime
from enum import Enum

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field


class TaskStatus(str, Enum):
    """Lifecycle states of a maintenance task."""

    PENDING = "pending"
    EXPLORING = "exploring"
    PATCH_READY = "patch_ready"
    APPROVED = "approved"
    PR_CREATED = "pr_created"
    REJECTED = "rejected"


class TaskCreate(BaseModel):
    """Schema for creating a new task via the API."""

    title: str = Field(..., min_length=1, max_length=200, description="Short title for the task")
    description: str = Field(..., min_length=1, description="Detailed bug report or task instruction")
    repo_full_name: str = Field(
        ...,
        pattern=r"^[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+$",
        description="GitHub repo in 'owner/name' format",
    )


class TaskRecord(BaseModel):
    """Schema representing a task row stored in Supabase."""

    id: str
    title: str
    description: str
    repo_full_name: str
    status: TaskStatus
    created_at: datetime
    updated_at: datetime
