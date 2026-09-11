from __future__ import annotations

"""
Notification Dispatcher.

Sends real-time notifications to Slack/Discord webhooks when
AI tasks complete or require human review.
"""

import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


class NotificationService:
    """Dispatches webhook alerts for task events."""

    def __init__(self, webhook_url: Optional[str] = None) -> None:
        self.webhook_url = webhook_url

    async def send_patch_ready_alert(
        self,
        task_id: str,
        title: str,
        repo_full_name: str,
        patch_count: int,
    ) -> bool:
        """Send a notification when an AI patch is generated and ready for human approval."""
        if not self.webhook_url:
            logger.info("NotificationService: No webhook_url configured. Skipping alert.")
            return False

        message = {
            "text": (
                f"🤖 *AI Dev Team Alert* | Patch Ready for Review!\n"
                f"• *Task*: {title}\n"
                f"• *Repo*: `{repo_full_name}`\n"
                f"• *Patches Generated*: {patch_count}\n"
                f"• *Task ID*: `{task_id}`\n\n"
                f"👉 Please review and approve in the Command Board Dashboard."
            )
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(self.webhook_url, json=message)
                response.raise_for_status()
                logger.info("NotificationService: Sent patch_ready alert for task_id=%s", task_id)
                return True
        except Exception as e:
            logger.error("NotificationService: Failed to dispatch alert: %s", e)
            return False


notifier = NotificationService()
