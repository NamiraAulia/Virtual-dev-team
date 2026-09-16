from __future__ import annotations
from app.infrastructure.security.sanitizer import DataSanitizer

"""
Sentry Webhook Endpoint.

Receives error alerts from Sentry.io, performs task deduplication,
creates a TaskRecord in Supabase, and enqueues the task for AI background execution.
"""

import logging
from typing import Any, Optional

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel

from app.config import Settings, get_settings
from app.domain.task import TaskCreate, TaskRecord
from app.infrastructure.database.supabase_client import SupabaseClient
from app.infrastructure.queue.task_queue import task_queue

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])


def get_db(settings: Settings = Depends(get_settings)) -> SupabaseClient:
    """Provide a SupabaseClient instance."""
    return SupabaseClient(url=settings.supabase_url, key=settings.supabase_service_role_key)


class SentryWebhookResponse(BaseModel):
    """Response returned after processing a Sentry webhook payload."""

    status: str
    message: str
    task_id: Optional[str] = None


def parse_sentry_payload(payload: dict[str, Any], default_repo: str) -> tuple[str, str, str]:
    """
    Extract title, description, and repo_full_name from various Sentry payload formats,
    scrubbing any sensitive credentials or PII before storing/processing.

    Returns:
        tuple[title, description, repo_full_name]
    """
    safe_payload = DataSanitizer.sanitize_dict(payload)

    # Format A: Issue Alert Webhook payload (data.issue)
    if "data" in safe_payload and "issue" in safe_payload["data"]:
        issue = safe_payload["data"]["issue"]
        title = issue.get("title", "Unhandled Runtime Error from Sentry")
        culprit = issue.get("culprit", "Unknown location")
        project_slug = issue.get("project", {}).get("slug", "")
        metadata = issue.get("metadata", {})
        error_value = metadata.get("value", "")

        description = (
            f"**Source**: Sentry.io Production Alert\n"
            f"**Error**: `{title}`\n"
            f"**Value**: {error_value}\n"
            f"**Location / Stacktrace**: `{culprit}`\n\n"
            f"Please inspect the location and apply a null-safe fix."
        )

    # Format B: Generic Sentry Event Webhook (event object)
    elif "event" in safe_payload:
        event = safe_payload["event"]
        title = event.get("title", "Runtime Crash Alert")
        culprit = event.get("culprit", event.get("location", "Unknown location"))
        project_slug = safe_payload.get("project_slug", safe_payload.get("project", ""))

        description = (
            f"**Source**: Sentry Event Webhook\n"
            f"**Error**: `{title}`\n"
            f"**Culprit**: `{culprit}`\n\n"
            f"Verify the stacktrace location and generate a search-and-replace patch."
        )

    # Format C: Direct payload (fallback)
    else:
        title = safe_payload.get("title", "Sentry Alert")
        culprit = safe_payload.get("culprit", "Unknown")
        project_slug = safe_payload.get("project", "")
        description = f"Sentry alert: {title} at {culprit}"

    # Resolve target repo (fallback to default repo if not matched)
    repo_full_name = default_repo
    if "/" in project_slug:
        repo_full_name = project_slug

    return title, description, repo_full_name


@router.post("/sentry", response_model=SentryWebhookResponse, status_code=201)
async def handle_sentry_webhook(
    payload: dict[str, Any],
    db: SupabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> SentryWebhookResponse:
    """
    Handle incoming Sentry.io HTTP POST webhooks.
    1. Parse payload to extract error context.
    2. Check for duplicate pending/exploring tasks in Supabase.
    3. Auto-create new task in Supabase.
    4. Enqueue for rate-limited background AI execution.
    """
    title, description, repo_full_name = parse_sentry_payload(
        payload=payload,
        default_repo=settings.target_repo,
    )

    logger.info("Sentry Webhook received: '%s' for repo '%s'", title, repo_full_name)

    # Deduplication check: check if task with exact same title exists and is active
    existing_tasks = db.list_tasks()
    for task in existing_tasks:
        if task.title == title and task.status in ["pending", "exploring", "patch_ready"]:
            logger.info("Deduplication: Active task id=%s with title '%s' already exists.", task.id, title)
            return SentryWebhookResponse(
                status="skipped",
                message=f"Task already exists and is active (id={task.id})",
                task_id=task.id,
            )

    # Create new task
    task_input = TaskCreate(
        title=title,
        description=description,
        repo_full_name=repo_full_name,
    )
    created_task = db.create_task(task_input)

    # Enqueue task for background rate-limited AI execution
    await task_queue.enqueue(created_task.id)

    return SentryWebhookResponse(
        status="created",
        message="Task created successfully and queued for AI execution",
        task_id=created_task.id,
    )
