from __future__ import annotations

"""
Gemini AI Engine.

Autonomous agentic loop powered by Google Gemini 2.0 Flash (temperature: 0).
Uses function-calling with GitHubAdapter tools (list_directory, read_file, search_code)
to explore a repository and generate structured PatchSets. Enforces a 5-round guardrail.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

# pyrefly: ignore [missing-import]
from google import genai
# pyrefly: ignore [missing-import]
from google.genai import types

from app.domain.patch import PatchAction, PatchSet
from app.domain.task import TaskRecord
from app.domain.task_log import TaskLogEntry
from app.infrastructure.database.supabase_client import SupabaseClient
from app.infrastructure.github.adapter import GitHubAdapter

logger = logging.getLogger(__name__)

SYSTEM_INSTRUCTION = """You are an elite Autonomous Software Maintenance AI Engineer.
Your mission is to investigate an issue or task in a GitHub repository, identify the root cause, and propose a precise search-and-replace patch.

You have access to 3 tools to explore the codebase:
1. list_directory(path: str): List files and folders at a directory path (use "" for root).
2. read_file(file_path: str): Read the full content of a text file (guardrail limit ≤ 100KB).
3. search_code(query: str): Search for code occurrences or symbols across the repository.

Operational Guidelines:
- Explore efficiently. Start by searching or listing the relevant directory.
- Read only the files necessary to diagnose the issue and design the fix.
- Do NOT guess file paths or contents without inspecting them with tools first.
- When you have enough context and have formulated the exact fix, STOP calling tools and output your final response.

Final Response Format:
Your final response MUST be a valid JSON object matching this schema (do NOT include extraneous conversation outside or inside the JSON block):
```json
{
  "summary": "Brief, clear explanation of the root cause and the changes made.",
  "actions": [
    {
      "file_path": "path/to/target/file.py",
      "search_block": "exact lines of code in the target file to be replaced",
      "replace_block": "new replacement lines of code",
      "explanation": "Why this specific change was made."
    }
  ]
}
```
Important Rules for search_block:
- search_block must match the exact indentation and text currently in the file.
- Keep search_block concise and uniquely identifiable.
"""


class GeminiEngine:
    """
    Autonomous AI agent powered by Gemini 2.0 Flash.

    Configuration:
        - model: gemini-2.0-flash
        - temperature: 0 (deterministic output)
        - max_tool_rounds: 5 (guardrail against infinite loops)
    """

    MODEL_NAME = "gemini-2.0-flash"
    TEMPERATURE = 0.0
    MAX_TOOL_ROUNDS = 5

    def __init__(
        self,
        api_key: str,
        github_adapter: GitHubAdapter,
        client: genai.Client | None = None,
    ) -> None:
        self._api_key = api_key
        self._github = github_adapter
        self._client = client or genai.Client(api_key=api_key)
        logger.info(
            "GeminiEngine initialized for repo '%s' with model '%s' (temp=%s, max_rounds=%d)",
            github_adapter.repo_full_name,
            self.MODEL_NAME,
            self.TEMPERATURE,
            self.MAX_TOOL_ROUNDS,
        )

    def _get_tools(self) -> list[Any]:
        """
        Define the callable tools for Gemini function-calling.
        """

        def list_directory(path: str = "") -> list[dict]:
            """
            List files and directories at the given path in the repository.
            Args:
                path: Directory path relative to repository root. Use empty string '' for root.
            """
            return self._github.list_directory(path=path)

        def read_file(file_path: str) -> dict:
            """
            Read the contents of a file from the repository (max 100KB).
            Args:
                file_path: Relative path to the file within the repository.
            """
            return self._github.read_file(file_path=file_path)

        def search_code(query: str) -> list[dict]:
            """
            Search for code matching a query within the repository.
            Args:
                query: Search query string (e.g. function name, class name, error message).
            """
            return self._github.search_code(query=query)

        return [list_directory, read_file, search_code]

    def _execute_tool(self, name: str, args: dict[str, Any]) -> Any:
        """Execute a tool call against the GitHub adapter with normalized tool names."""
        normalized = name.lower().replace("_", "")
        if normalized == "listdirectory":
            path = args.get("path", "")
            return self._github.list_directory(path=path)
        elif normalized == "readfile":
            file_path = args.get("file_path", "") or args.get("filePath", "")
            return self._github.read_file(file_path=file_path)
        elif normalized == "searchcode":
            query = args.get("query", "")
            return self._github.search_code(query=query)
        else:
            logger.warning("Unrecognized tool name called: %s", name)
            return {"error": f"Unknown tool: '{name}'"}

    def _extract_patch_set(self, response_text: str, task_id: str) -> PatchSet:
        """
        Extract and parse a structured PatchSet from Gemini's response text.
        Handles markdown code blocks and raw JSON strings.
        """
        text = response_text.strip()

        # Attempt to extract JSON from markdown code fence
        json_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
        if json_match:
            raw_json = json_match.group(1).strip()
        else:
            # Fallback to looking for matching outermost curly braces
            brace_match = re.search(r"(\{[\s\S]*\})", text)
            raw_json = brace_match.group(1).strip() if brace_match else text

        try:
            data = json.loads(raw_json)
        except json.JSONDecodeError as err:
            logger.error("Failed to parse PatchSet JSON from model output: %s\nOutput:\n%s", err, text)
            raise ValueError(f"AI response is not valid JSON: {err}") from err

        summary = data.get("summary", "Automated AI patch")
        actions_raw = data.get("actions", [])

        if not isinstance(actions_raw, list) or len(actions_raw) == 0:
            raise ValueError("AI response does not contain any patch actions.")

        actions = [
            PatchAction(
                file_path=a.get("file_path", ""),
                search_block=a.get("search_block", ""),
                replace_block=a.get("replace_block", ""),
                explanation=a.get("explanation", ""),
            )
            for a in actions_raw
        ]

        return PatchSet(
            task_id=task_id,
            summary=summary,
            actions=actions,
        )

    async def run_exploration(
        self,
        task: TaskRecord,
        db: SupabaseClient | None = None,
    ) -> PatchSet:
        """
        Execute the autonomous agentic loop:
        1. Send task description + tools to Gemini 2.0 Flash (temp: 0).
        2. Loop: if Gemini requests tool call -> execute tool -> return output -> repeat.
        3. Enforce 5-round guardrail.
        4. When Gemini finishes, parse and return structured PatchSet.
        """
        logger.info(
            "Starting autonomous exploration for task id=%s title='%s'",
            task.id,
            task.title,
        )

        config = types.GenerateContentConfig(
            temperature=self.TEMPERATURE,
            system_instruction=SYSTEM_INSTRUCTION,
            tools=self._get_tools(),
        )

        user_prompt = (
            f"Repository: {task.repo_full_name}\n"
            f"Task Title: {task.title}\n"
            f"Task Description:\n{task.description}\n\n"
            "Please explore the repository to locate the issue, verify the relevant code, "
            "and output the final PatchSet JSON."
        )

        contents: list[types.Content] = [
            types.Content(role="user", parts=[types.Part.from_text(text=user_prompt)])
        ]

        step_counter = 0
        round_counter = 0

        while round_counter < self.MAX_TOOL_ROUNDS:
            round_counter += 1
            logger.info(
                "Task id=%s | Turn round %d/%d calling Gemini model...",
                task.id,
                round_counter,
                self.MAX_TOOL_ROUNDS,
            )

            # Call Gemini
            response = self._client.models.generate_content(
                model=self.MODEL_NAME,
                contents=contents,
                config=config,
            )

            # Validate response candidate
            if not response.candidates or not response.candidates[0].content:
                raise RuntimeError("Empty response received from Gemini model.")

            candidate_content = response.candidates[0].content
            contents.append(candidate_content)

            # Check if Gemini triggered any function calls
            function_calls = response.function_calls
            if not function_calls:
                # No function calls -> Model produced final response
                logger.info("Task id=%s | Model produced final response in round %d.", task.id, round_counter)
                response_text = response.text or ""
                return self._extract_patch_set(response_text, task.id)

            # Execute tool calls and build function responses
            tool_response_parts: list[types.Part] = []
            for fc in function_calls:
                step_counter += 1
                tool_name = fc.name
                tool_args = fc.args or {}

                logger.info(
                    "Task id=%s | Step %d: executing tool '%s' with args %s",
                    task.id,
                    step_counter,
                    tool_name,
                    tool_args,
                )

                tool_result = self._execute_tool(tool_name, tool_args)

                # Record audit log in database if available
                if db:
                    try:
                        log_entry = TaskLogEntry(
                            task_id=task.id,
                            step_number=step_counter,
                            tool_name=tool_name,
                            tool_input=tool_args,
                            tool_output=json.dumps(tool_result)[:4000],
                            created_at=datetime.now(timezone.utc),
                        )
                        db.append_log(log_entry)
                    except Exception as log_err:
                        logger.warning("Failed to record task audit log: %s", log_err)

                tool_response_parts.append(
                    types.Part.from_function_response(
                        name=tool_name,
                        response={"result": tool_result},
                    )
                )

            # Append tool outputs back to conversation
            contents.append(types.Content(role="user", parts=tool_response_parts))

        # If guardrail reached (5 rounds) and still calling tools, request immediate synthesis
        logger.warning(
            "Task id=%s reached max tool rounds (%d). Requesting immediate final synthesis.",
            task.id,
            self.MAX_TOOL_ROUNDS,
        )

        final_prompt = (
            "You have reached the maximum allowed tool exploration rounds (5). "
            "Based strictly on the information gathered so far, provide your final PatchSet JSON immediately."
        )
        contents.append(
            types.Content(role="user", parts=[types.Part.from_text(text=final_prompt)])
        )

        # Call model with temperature 0 to finalize without further tools
        final_config = types.GenerateContentConfig(
            temperature=self.TEMPERATURE,
            system_instruction=SYSTEM_INSTRUCTION,
        )
        final_response = self._client.models.generate_content(
            model=self.MODEL_NAME,
            contents=contents,
            config=final_config,
        )

        response_text = final_response.text or ""
        return self._extract_patch_set(response_text, task.id)
