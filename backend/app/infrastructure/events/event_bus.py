from __future__ import annotations

"""
In-memory asynchronous Event Bus for Server-Sent Events (SSE).

Enables real-time push streaming of task logs, status updates, and patches
to connected frontend clients without database polling.
"""

import asyncio
import json
import logging
from typing import Any, AsyncGenerator

logger = logging.getLogger(__name__)


class TaskEventBus:
    """
    Manages client subscriptions to task event streams via asyncio.Queue.
    """

    def __init__(self) -> None:
        # task_id -> set of asyncio.Queue
        self._subscribers: dict[str, set[asyncio.Queue]] = {}

    def subscribe(self, task_id: str) -> asyncio.Queue:
        """Subscribe a new client listener for a specific task_id."""
        if task_id not in self._subscribers:
            self._subscribers[task_id] = set()
        queue: asyncio.Queue = asyncio.Queue(maxsize=100)
        self._subscribers[task_id].add(queue)
        logger.info("SSE: Client subscribed to task id=%s (total listeners: %d)", task_id, len(self._subscribers[task_id]))
        return queue

    def unsubscribe(self, task_id: str, queue: asyncio.Queue) -> None:
        """Unsubscribe a client listener."""
        if task_id in self._subscribers and queue in self._subscribers[task_id]:
            self._subscribers[task_id].remove(queue)
            if not self._subscribers[task_id]:
                del self._subscribers[task_id]
            logger.info("SSE: Client unsubscribed from task id=%s", task_id)

    async def publish(self, task_id: str, event_type: str, data: dict[str, Any]) -> None:
        """
        Publish an event to all active client listeners for task_id.
        """
        if task_id not in self._subscribers or not self._subscribers[task_id]:
            return

        payload = {
            "type": event_type,
            "data": data,
        }

        dead_queues: list[asyncio.Queue] = []
        for queue in list(self._subscribers[task_id]):
            try:
                queue.put_nowait(payload)
            except asyncio.QueueFull:
                logger.warning("SSE: Queue full for task id=%s listener, dropping old message", task_id)
            except Exception as err:
                logger.warning("SSE: Error publishing to listener for task id=%s: %s", task_id, err)
                dead_queues.append(queue)

        for dq in dead_queues:
            self.unsubscribe(task_id, dq)


# Global singleton instance
task_event_bus = TaskEventBus()
