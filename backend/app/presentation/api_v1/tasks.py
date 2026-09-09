from __future__ import annotations

"""
Task API routes (v1).

REST endpoints for the Command Board frontend to create, list,
approve tasks, and view audit logs.
"""

import logging

# pyrefly: ignore [missing-import]
from fastapi import APIRouter, Depends, HTTPException

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
    repo_full_name: str | None = None,
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


@router.post("/{task_id}/run", response_model=TaskRecord)
async def run_task(
    task_id: str,
    db: SupabaseClient = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TaskRecord:
    """
    Trigger AI exploration for a task.
    Invokes GeminiEngine.run_exploration() with Gemini 2.0 Flash and GitHub tools.
    """
    task = db.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")

    if task.status != TaskStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"Task must be in 'pending' status to run. Current: '{task.status.value}'",
        )

    # Update status to exploring
    db.update_task_status(task_id, TaskStatus.EXPLORING)
    task = db.get_task(task_id) or task

    try:
        github = GitHubAdapter(settings.github_personal_access_token, task.repo_full_name)
        engine = GeminiEngine(settings.google_generative_ai_api_key, github)
        patch_set = await engine.run_exploration(task, db=db)
        db.save_patches(patch_set.actions, task_id)
        updated = db.update_task_status(task_id, TaskStatus.PATCH_READY)
        logger.info("API: Task id=%s exploration completed, status set to patch_ready", task_id)
        return updated or task
    except Exception as err:
        logger.error("API: Exploration failed for task id=%s: %s", task_id, err, exc_info=True)
        db.update_task_status(task_id, TaskStatus.PENDING)
        raise HTTPException(
            status_code=500,
            detail=f"Autonomous AI exploration failed: {err}",
        )


@router.post("/{task_id}/approve", response_model=ApproveResponse)
def approve_task(
    task_id: str,
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
        github.commit_changes(
            branch=branch_name,
            patches=patch_actions,
            commit_message=f"fix: {task.title}",
        )
        pr_url = github.create_pull_request(
            branch=branch_name,
            title=f"[AI Fix] {task.title}",
            body=(
                f"## Automated Fix by AI Dev Engine\n\n"
                f"**Task:** {task.title}\n"
                f"**Description:** {task.description}\n\n"
                f"### Changes\n"
                + "\n".join(
                    f"- `{p.file_path}`: {p.explanation}" for p in patch_actions
                )
            ),
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
