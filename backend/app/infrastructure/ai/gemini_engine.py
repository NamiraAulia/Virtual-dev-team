from __future__ import annotations

"""
Gemini AI Engine (Skeleton).

This module will house the autonomous agentic loop that uses
Google Gemini 2.0 Flash with function-calling to explore a GitHub
repository and produce structured PatchSets.

Full implementation is planned for Sprint 2.
"""

import logging

from app.domain.patch import PatchSet
from app.domain.task import TaskRecord
from app.infrastructure.github.adapter import GitHubAdapter

logger = logging.getLogger(__name__)


class GeminiEngine:
    """
    Autonomous AI agent powered by Gemini 2.0 Flash.

    Uses function-calling with three tools (readFile, listDirectory,
    searchCode) to explore a GitHub repository and generate structured
    patch proposals.

    Configuration:
        - temperature: 0 (deterministic output)
        - model: gemini-2.0-flash
    """

    def __init__(self, api_key: str, github_adapter: GitHubAdapter) -> None:
        self._api_key = api_key
        self._github = github_adapter
        logger.info(
            "GeminiEngine initialized for repo '%s' (Sprint 2 skeleton)",
            github_adapter.repo_full_name,
        )

    def _build_tools(self) -> list[dict]:
        """
        Build the tool/function declarations for Gemini function-calling.

        Defines three tools:
          - listDirectory(path: str) → list files/dirs
          - readFile(file_path: str) → read file content (≤100KB)
          - searchCode(query: str)   → search code in repo
        """
        return [
            {
                "name": "listDirectory",
                "description": "List files and directories at a given path in the repository.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Directory path relative to repo root. Use '' for root.",
                        }
                    },
                    "required": ["path"],
                },
            },
            {
                "name": "readFile",
                "description": "Read the contents of a file. Max 100KB.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "file_path": {
                            "type": "string",
                            "description": "File path relative to repo root.",
                        }
                    },
                    "required": ["file_path"],
                },
            },
            {
                "name": "searchCode",
                "description": "Search for code matching a query in the repository.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Search query string.",
                        }
                    },
                    "required": ["query"],
                },
            },
        ]

    async def run_exploration(self, task: TaskRecord) -> PatchSet:
        """
        Execute the autonomous agentic loop:
        1. Send task description + tool definitions to Gemini
        2. Loop: receive tool calls → execute via GitHubAdapter → return results
        3. Continue until Gemini produces a structured PatchSet
        4. Validate and return the PatchSet

        Raises NotImplementedError — full implementation in Sprint 2.
        """
        raise NotImplementedError(
            "GeminiEngine.run_exploration() is a Sprint 2 deliverable. "
            "The agentic loop with Gemini function-calling will be "
            "implemented after the foundation layer is verified."
        )
