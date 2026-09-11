from __future__ import annotations

"""
Task API routes (v1).

REST endpoints for the Command Board frontend to create, list,
approve tasks, and view audit logs.
"""

import logging
from typing import Optional, List

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Request

from app.config import Settings, get_settings
from app.domain.patch import PatchRecord
from app.domain.task import TaskCreate, TaskRecord, TaskStatus
from app.domain.task_log import TaskLogEntry
from app.infrastructure.ai.gemini_engine import GeminiEngine
from app.infrastructure.database.supabase_client import SupabaseClient
from app.infrastructure.github.adapter import GitHubAdapter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])

def get_db(settings: Settings = Depends(get_settings)) -> SupabaseClient:
    """Provide a SupabaseClient instance."""
    return SupabaseClient(url=settings.supabase_url, key=settings.supabase_service_role_key)


def get_github(
    repo_full_name: Optional[str] = None,
    settings: Settings = Depends(get_settings),
) -> GitHubAdapter:
    """Provide a GitHubAdapter instance for a specific repo."""
    repo = repo_full_name or settings.target_repo
    return GitHubAdapter(token=settings.github_personal_access_token, repo_full_name=repo)


# pyrefly: ignore [missing-import]
from pydantic import BaseModel



class TaskDetailResponse(BaseModel):
    """Task detail with its associated patches."""

    task: TaskRecord
    patches: list[PatchRecord]


class ApproveResponse(BaseModel):
    """Response from the approve endpoint."""

    task: TaskRecord
    pr_url: str


@router.post("", response_model=TaskRecord, status_code=201)
def create_task(
    body: TaskCreate,
    db: SupabaseClient = Depends(get_db),
) -> TaskRecord:
    """Create a new maintenance task."""
    task = db.create_task(body)
    logger.info("API: Created task id=%s", task.id)
    return task


@router.get("", response_model=list[TaskRecord])
def list_tasks(db: SupabaseClient = Depends(get_db)) -> list[TaskRecord]:
    """List all tasks (newest first)."""
    return db.list_tasks()


@router.get("/{task_id}", response_model=TaskDetailResponse)
def get_task(
    task_id: str,
    db: SupabaseClient = Depends(get_db),
) -> TaskDetailResponse:
    """Get a single task with its patches."""
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    patches = db.get_patches_by_task(task_id)
    return TaskDetailResponse(task=task, patches=patches)


from app.use_cases.patch_generator import (
    PatchGeneratorUseCase,
    TaskNotFoundError,
    InvalidTaskStatusError,
    ExplorationExecutionError,
)

patch_generator_use_case = PatchGeneratorUseCase()


@router.post("/{task_id}/run", response_model=TaskRecord)
async def run_task(
    task_id: str,
    language: str = "en",
    model: Optional[str] = None,
    db: SupabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TaskRecord:
    """
    Trigger AI exploration for a task via PatchGeneratorUseCase.
    Coordinates Supabase, Gemini 2.0 Flash engine, GitHub tools, and audit logs.
    """
    try:
        updated_task, _ = await patch_generator_use_case.execute(
            task_id=task_id,
            db=db,
            settings=settings,
            language=language,
            model_name=model,
        )
        return updated_task
    except TaskNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except InvalidTaskStatusError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ExplorationExecutionError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        logger.error("API: Unexpected error in run_task for task id=%s: %s", task_id, e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")


def parse_sentry_payload(payload: dict, default_repo: str) -> tuple[str, str, str]:
    """Extract issue title, detailed description, and repo from Sentry webhook payload."""
    title = ""
    description_lines = []
    repo = default_repo

    # Check Sentry format: Alert webhook or Issue webhook or Event webhook
    data = payload.get("data", {})
    issue = data.get("issue") or payload.get("issue") or {}
    event = data.get("event") or payload.get("event") or {}

    # Extract title
    if issue.get("title"):
        title = issue["title"]
    elif event.get("title"):
        title = event["title"]
    elif payload.get("message"):
        title = payload["message"]
    elif event.get("message"):
        title = event["message"]
    else:
        title = "Sentry Error: Automated Issue Alert"

    # Extract culprit / location
    culprit = issue.get("culprit") or event.get("culprit") or payload.get("culprit")
    sentry_url = issue.get("permalink") or issue.get("url") or payload.get("url") or event.get("web_url")

    description_lines.append("### Sentry Automated Issue Ingestion")
    description_lines.append(f"**Issue Title:** {title}")
    if culprit:
        description_lines.append(f"**Location/Culprit:** `{culprit}`")
    if sentry_url:
        description_lines.append(f"**Sentry Issue Link:** {sentry_url}")

    # Extract stacktrace or exception details if available
    exception_values = (
        event.get("entries", [{}])[0].get("data", {}).get("values")
        or event.get("exception", {}).get("values")
        or []
    )
    if exception_values:
        description_lines.append("\n#### Exception Details:")
        for exc in exception_values:
            exc_type = exc.get("type", "Exception")
            exc_val = exc.get("value", "")
            description_lines.append(f"- **{exc_type}**: {exc_val}")

            # Stacktrace frames
            frames = exc.get("stacktrace", {}).get("frames", [])
            if frames:
                description_lines.append("\n```text")
                for f in frames[-5:]:  # Last 5 frames
                    filename = f.get("filename") or f.get("abs_path") or "unknown"
                    lineno = f.get("lineno", "?")
                    function = f.get("function", "?")
                    context_line = f.get("context_line", "").strip()
                    description_lines.append(f"  File \"{filename}\", line {lineno}, in {function}")
                    if context_line:
                        description_lines.append(f"    {context_line}")
                description_lines.append("```")
    elif payload.get("description"):
        description_lines.append(f"\n{payload['description']}")

    # Extract repo from tags if present
    tags = event.get("tags") or issue.get("tags") or []
    if isinstance(tags, list):
        for tag in tags:
            if isinstance(tag, list) and len(tag) >= 2:
                if tag[0] in ("repo", "repository", "github_repo"):
                    repo = tag[1]
            elif isinstance(tag, dict):
                if tag.get("key") in ("repo", "repository", "github_repo"):
                    repo = tag.get("value", repo)

    return title, "\n".join(description_lines), repo


async def _run_ai_pipeline_background(
    task_id: str,
    language: str,
    settings: Settings,
):
    """Background task to run AI exploration without blocking webhook response."""
    db = SupabaseClient(url=settings.supabase_url, key=settings.supabase_service_role_key)
    try:
        logger.info("Sentry Webhook: Starting background AI exploration for task id=%s", task_id)
        await patch_generator_use_case.execute(
            task_id=task_id,
            db=db,
            settings=settings,
            language=language,
        )
        logger.info("Sentry Webhook: Completed AI exploration for task id=%s", task_id)
    except Exception as e:
        logger.error(
            "Sentry Webhook: Background AI exploration failed for task id=%s: %s",
            task_id,
            e,
            exc_info=True,
        )


@router.post("/webhook/sentry", status_code=201)
async def sentry_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: SupabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Webhook endpoint to automatically ingest issues from Sentry.
    Parses the error payload, creates a Task in Supabase, and triggers
    AI exploration in the background.
    """
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    title, description, repo = parse_sentry_payload(payload, default_repo=settings.target_repo)

    task_create = TaskCreate(
        title=title[:200],
        description=description,
        repo_full_name=repo or settings.target_repo,
    )
    task = db.create_task(task_create)
    logger.info("Sentry Webhook: Successfully created task id=%s for '%s'", task.id, title)

    # Auto-run AI exploration in background
    background_tasks.add_task(
        _run_ai_pipeline_background,
        task_id=task.id,
        language="id",
        settings=settings,
    )

    return {
        "status": "success",
        "message": "Task created and AI exploration triggered",
        "task_id": task.id,
        "task": task,
    }




@router.post("/{task_id}/approve", response_model=ApproveResponse)
def approve_task(
    task_id: str,
    language: str = "en",
    db: SupabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> ApproveResponse:
    """
    Approve all patches for a task and create a Pull Request.

    Flow:
    1. Validate task is in 'patch_ready' status
    2. Create branch ai-fix/task-{id}
    3. Commit all approved patches
    4. Open PR to main
    5. Update task status to 'pr_created'
    """
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    if task.status != TaskStatus.PATCH_READY:
        raise HTTPException(
            status_code=400,
            detail=f"Task must be in 'patch_ready' status to approve. Current: '{task.status.value}'",
        )

    patches = db.get_patches_by_task(task_id)
    if not patches:
        raise HTTPException(status_code=400, detail="No patches found for this task")

    # Convert PatchRecords back to PatchActions for the adapter
    from app.domain.patch import PatchAction

    patch_actions = [
        PatchAction(
            file_path=p.file_path,
            search_block=p.search_block,
            replace_block=p.replace_block,
            explanation=p.explanation,
        )
        for p in patches
        if p.status == "pending" or p.status == "approved"
    ]

    if not patch_actions:
        raise HTTPException(status_code=400, detail="No approved/pending patches to apply")

    # Execute PR pipeline
    github = GitHubAdapter(
        token=settings.github_personal_access_token,
        repo_full_name=task.repo_full_name,
    )

    branch_name = f"ai-fix/task-{task_id[:8]}"

    try:
        github.create_branch(branch_name)
        commit_msg = f"perbaikan: {task.title}" if language == "id" else f"fix: {task.title}"
        github.commit_changes(
            branch=branch_name,
            patches=patch_actions,
            commit_message=commit_msg,
        )

        if language == "id":
            pr_body = (
                f"## Perbaikan Otomatis oleh AI Dev Engine\n\n"
                f"**Tugas:** {task.title}\n"
                f"**Deskripsi:** {task.description}\n\n"
                f"### Rincian Perubahan\n"
                + "\n".join(
                    f"- `{p.file_path}`: {p.explanation}" for p in patch_actions
                )
            )
        else:
            pr_body = (
                f"## Automated Fix by AI Dev Engine\n\n"
                f"**Task:** {task.title}\n"
                f"**Description:** {task.description}\n\n"
                f"### Changes\n"
                + "\n".join(
                    f"- `{p.file_path}`: {p.explanation}" for p in patch_actions
                )
            )

        pr_url = github.create_pull_request(
            branch=branch_name,
            title=f"[AI Fix] {task.title}",
            body=pr_body,
        )
    except Exception as e:
        logger.error("PR pipeline failed for task %s: %s", task_id, e)
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}")

    # Update statuses
    db.update_task_status(task_id, TaskStatus.PR_CREATED)
    for p in patches:
        db.update_patch_status(p.id, "approved")

    updated_task = db.get_task(task_id)
    return ApproveResponse(task=updated_task, pr_url=pr_url)


class RejectRequest(BaseModel):
    """Optional rejection reason."""
    reason: Optional[str] = None


@router.post("/{task_id}/reject", response_model=TaskRecord)
def reject_task(
    task_id: str,
    body: Optional[RejectRequest] = None,
    db: SupabaseClient = Depends(get_db),
) -> TaskRecord:
    """
    Reject the patches proposed for a task.
    Updates task status to 'rejected' and marks associated patches as rejected.
    """
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    patches = db.get_patches_by_task(task_id)
    for p in patches:
        db.update_patch_status(p.id, "rejected")

    updated_task = db.update_task_status(task_id, TaskStatus.REJECTED)
    logger.info("API: Task id=%s was rejected (reason: %s)", task_id, body.reason if body else "None")
    return updated_task or task



@router.get("/{task_id}/logs", response_model=list[TaskLogEntry])
def get_task_logs(
    task_id: str,
    db: SupabaseClient = Depends(get_db),
) -> list[TaskLogEntry]:
    """Get all audit log entries for a task."""
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    return db.get_logs_by_task(task_id)

