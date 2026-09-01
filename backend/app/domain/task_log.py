"""
Task log domain model.

Records each step of the AI agent's tool-calling loop for
observability and audit purposes.
"""

from datetime import datetime
from typing import Any

# pyrefly: ignore [missing-import]
from pydantic import BaseModel, Field


class TaskLogEntry(BaseModel):
    """A single audit log entry for one AI tool invocation."""

    task_id: str = Field(..., description="UUID of the parent task")
    step_number: int = Field(..., ge=1, description="Sequential step number within the task")
    tool_name: str = Field(
        ...,
        description="Name of the tool called: readFile | listDirectory | searchCode",
    )
    tool_input: dict[str, Any] = Field(..., description="Arguments passed to the tool")
    tool_output: str = Field(..., description="Response from the tool (truncated if needed)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
