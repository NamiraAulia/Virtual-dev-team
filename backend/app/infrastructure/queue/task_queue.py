from __future__ import annotations

"""
Task Queue & Rate Limiter Service.

Provides background task queuing and throttling to protect
Gemini API Free Tier rate limits (15 RPM / 1,500 RPD).
"""

import asyncio
import logging
from typing import Callable, Awaitable, Optional

logger = logging.getLogger(__name__)

# Default throttle delay between AI exploration tasks (5 seconds)
DEFAULT_THROTTLE_DELAY_SECONDS = 5.0


class TaskQueueWorker:
    """
    In-memory async queue worker with throttling rate-limiter.
    """

    def __init__(
        self,
        throttle_delay: float = DEFAULT_THROTTLE_DELAY_SECONDS,
        processor: Optional[Callable[[str], Awaitable[None]]] = None,
    ) -> None:
        self._queue: asyncio.Queue[str] = asyncio.Queue()
        self._throttle_delay = throttle_delay
        self._processor = processor
        self._worker_task: Optional[asyncio.Task] = None
        self._is_running = False

    def set_processor(self, processor: Callable[[str], Awaitable[None]]) -> None:
        """Set the async task processing callback function."""
        self._processor = processor

    async def enqueue(self, task_id: str) -> None:
        """Add a task ID to the execution queue."""
        await self._queue.put(task_id)
        logger.info("TaskQueue: Enqueued task_id=%s (Queue depth: %d)", task_id, self._queue.qsize())
        self.ensure_worker_started()

    def ensure_worker_started(self) -> None:
        """Start background worker loop if not already running."""
        if not self._is_running:
            self._is_running = True
            self._worker_task = asyncio.create_task(self._worker_loop())
            logger.info("TaskQueue: Started background rate-limited queue worker.")

    async def _worker_loop(self) -> None:
        """Worker loop that dequeues and processes tasks with throttle delays."""
        while self._is_running:
            try:
                task_id = await self._queue.get()
                logger.info("TaskQueue: Processing task_id=%s from queue...", task_id)

                if self._processor:
                    try:
                        await self._processor(task_id)
                    except Exception as err:
                        logger.error("TaskQueue: Execution error for task_id=%s: %s", task_id, err, exc_info=True)

                self._queue.task_done()

                # Rate-limiting throttle delay to respect Free Tier quota
                if self._throttle_delay > 0:
                    logger.info("TaskQueue: Throttling for %.1fs (Free Tier guardrail)...", self._throttle_delay)
                    await asyncio.sleep(self._throttle_delay)

            except asyncio.CancelledError:
                logger.info("TaskQueue: Worker loop cancelled.")
                break
            except Exception as err:
                logger.error("TaskQueue: Unexpected error in worker loop: %s", err, exc_info=True)

    async def stop(self) -> None:
        """Gracefully stop the background worker."""
        self._is_running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass


# Global singleton instance
task_queue = TaskQueueWorker()
