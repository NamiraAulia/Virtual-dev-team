from __future__ import annotations

"""
OpenRouter AI Engine.

Autonomous agentic loop powered by OpenRouter API (supports open source and free models like google/gemma-4-26b-a4b-it:free).
Uses function-calling with GitHubAdapter tools (list_directory, read_file, search_code)
to explore a repository and generate structured PatchSets conforming to PatchProposal schema.
Includes local verification (search_block exact match) and self-repair retry loop.
Enforces a 5-round exploration guardrail and 2-attempt self-repair limit.
"""

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

import httpx

from app.domain.patch import PatchAction, PatchProposal, PatchSet
from app.domain.task import TaskRecord
from app.domain.task_log import TaskLogEntry
from app.infrastructure.database.supabase_client import SupabaseClient
from app.infrastructure.events.event_bus import task_event_bus
from app.infrastructure.github.adapter import GitHubAdapter

logger = logging.getLogger(__name__)

OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

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
CRITICAL RULE: The `search_block` must be an EXACT literal substring from the target file, including all whitespace, indentation, and newlines.
"""


class OpenRouterEngine:
    """
    Autonomous AI agent powered by OpenRouter API.
    """

    DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning:free"
    TEMPERATURE = 0.0
    MAX_TOOL_ROUNDS = 5
    MAX_REPAIR_ATTEMPTS = 2

    def __init__(
        self,
        api_key: str,
        github_adapter: GitHubAdapter,
        model_name: str | None = None,
    ) -> None:
        self._api_key = api_key
        self._github = github_adapter
        self.model_name = model_name or self.DEFAULT_MODEL
        logger.info(
            "OpenRouterEngine initialized for repo '%s' with model '%s'",
            github_adapter.repo_full_name,
            self.model_name,
        )

    def _get_tools_schema(self) -> list[dict[str, Any]]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "list_directory",
                    "description": "List files and directories at the given path in repository. Use empty string '' for root.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Directory path relative to repo root (e.g. 'src' or '')",
                            }
                        },
                        "required": [],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read the text contents of a file from repository (max 100KB).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "file_path": {
                                "type": "string",
                                "description": "Relative path to file in repo",
                            }
                        },
                        "required": ["file_path"],
                    },
                },
            },
            {
                "type": "function",
                "function": {
                    "name": "search_code",
                    "description": "Search for code matching a query string across repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query string",
                            }
                        },
                        "required": ["query"],
                    },
                },
            },
        ]

    def _execute_tool(self, name: str, args: dict[str, Any]) -> Any:
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
        text = response_text.strip()
        data = None

        # 1. First, search for fenced ```json ... ``` code blocks
        for json_match in re.finditer(r"```(?:json)?\s*([\s\S]*?)\s*```", text):
            candidate = json_match.group(1).strip()
            try:
                parsed = json.loads(candidate)
                if isinstance(parsed, dict) and "actions" in parsed:
                    data = parsed
                    break
            except Exception:
                continue

        # 2. If not found in code fence, scan for { ... } containing "actions"
        if data is None:
            for start_idx in range(len(text)):
                if text[start_idx] == '{':
                    for end_idx in range(len(text), start_idx + 5, -1):
                        if text[end_idx - 1] == '}':
                            substring = text[start_idx:end_idx].strip()
                            if '"actions"' in substring:
                                try:
                                    parsed = json.loads(substring)
                                    if isinstance(parsed, dict) and "actions" in parsed:
                                        data = parsed
                                        break
                                except Exception:
                                    continue
                    if data:
                        break

        # 3. Fallback to direct json.loads
        if data is None:
            try:
                data = json.loads(text)
            except json.JSONDecodeError as err:
                logger.error("Failed to parse PatchSet JSON: %s\nText: %s", err, text)
                raise ValueError(f"AI response is not valid JSON: {err}") from err

        summary = data.get("summary", "Automated AI patch")
        actions_raw = data.get("actions", [])
        if not isinstance(actions_raw, list) or len(actions_raw) == 0:
            raise ValueError("AI response does not contain any patch actions.")

        actions = [
            PatchProposal(
                file_path=a.get("file_path", ""),
                action=PatchAction.MODIFY,
                search_block=a.get("search_block", ""),
                replace_block=a.get("replace_block", ""),
                explanation=a.get("explanation", ""),
            )
            for a in actions_raw
        ]

        return PatchSet(task_id=task_id, summary=summary, actions=actions)

    def verify_patch_locally(self, patch_set: PatchSet) -> tuple[bool, str | None]:
        for action in patch_set.actions:
            if not action.file_path:
                return False, "Patch action is missing 'file_path'."
            if not action.search_block:
                return False, f"Patch action for '{action.file_path}' is missing 'search_block'."

            try:
                file_data = self._github.read_file(action.file_path)
            except Exception as e:
                return False, f"Could not read target file '{action.file_path}': {e}"

            content = file_data.get("content", "")
            if not content:
                return False, f"Target file '{action.file_path}' is empty or could not be retrieved."

            norm_content = content.replace("\r\n", "\n")
            norm_search = action.search_block.replace("\r\n", "\n")

            if norm_search not in norm_content and norm_search.strip() not in norm_content:
                snippet = norm_content[:2500]
                return False, (
                    f"search_block was not found in file '{action.file_path}'. "
                    f"Here is actual file content to copy from:\n```\n{snippet}\n```\n"
                    f"Ensure exact indentation and line breaks."
                )

        return True, None

    async def _call_openrouter(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "HTTP-Referer": "http://localhost:5173",
            "X-Title": "Virtual Dev Team",
            "Content-Type": "application/json",
        }
        payload: dict[str, Any] = {
            "model": self.model_name,
            "messages": messages,
            "temperature": self.TEMPERATURE,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        async with httpx.AsyncClient(timeout=90.0) as client:
            resp = await client.post(OPENROUTER_API_URL, headers=headers, json=payload)
            if resp.status_code != 200:
                logger.error("OpenRouter API error (%d): %s", resp.status_code, resp.text)
                raise RuntimeError(f"OpenRouter API error {resp.status_code}: {resp.text}")
            return resp.json()

    def _extract_text_tool_calls(self, content: str) -> list[dict[str, Any]]:
        """Extract tool calls if the model emitted them as XML/text tags instead of standard OpenAI tool_calls."""
        calls = []
        # Pattern 1: <function=name><parameter=key>value</parameter></function>
        for m in re.finditer(r"<function=([a-zA-Z0-9_]+)>([\s\S]*?)</function>", content):
            fn_name = m.group(1).strip()
            body = m.group(2)
            args = {}
            for p in re.finditer(r"<parameter=([a-zA-Z0-9_]+)>\s*([\s\S]*?)\s*</parameter>", body):
                args[p.group(1).strip()] = p.group(2).strip()
            calls.append({"name": fn_name, "arguments": args})

        # Pattern 2: JSON formatted tool call inside ```json ``` or ``` ```
        if not calls:
            for jm in re.finditer(r"```(?:json)?\s*(\{\s*\"name\"\s*:\s*\"[a-zA-Z0-9_]+\"[\s\S]*?\})\s*```", content):
                try:
                    parsed = json.loads(jm.group(1))
                    if "name" in parsed:
                        calls.append({"name": parsed["name"], "arguments": parsed.get("arguments", {})})
                except Exception:
                    pass

        return calls

    async def run_exploration(
        self,
        task: TaskRecord,
        db: SupabaseClient | None = None,
        language: str = "en",
    ) -> PatchSet:
        logger.info(
            "Starting OpenRouter exploration for task id=%s (model=%s, language=%s)",
            task.id,
            self.model_name,
            language,
        )

        sys_inst = SYSTEM_INSTRUCTION
        if language == "id":
            sys_inst += (
                "\n\nLanguage Directive:\n"
                "You MUST write the 'summary' and each action's 'explanation' field in professional Bahasa Indonesia. "
                "The JSON schema keys, file paths, search_block, and replace_block must remain exact code and must NOT be translated."
            )

        # Pre-fetch relevant files from task text to accelerate exploration
        prefetched = self._github.prefetch_relevant_files(f"{task.title}\n{task.description}")
        context_blocks: list[str] = []
        if prefetched and isinstance(prefetched, dict) and len(prefetched) > 0:
            logger.info("OpenRouter Task id=%s | Pre-fetched %d relevant file(s): %s", task.id, len(prefetched), list(prefetched.keys()))
            for p_path, p_content in prefetched.items():
                context_blocks.append(f"--- [Pre-fetched File: {p_path}] ---\n{p_content}\n--- [End of {p_path}] ---")

            log_entry = TaskLogEntry(
                task_id=task.id,
                step_number=1,
                tool_name="prefetch_files",
                tool_input={"files": list(prefetched.keys())},
                tool_output=f"Successfully pre-fetched {len(prefetched)} files: {', '.join(prefetched.keys())}",
                created_at=datetime.now(timezone.utc),
            )
            if db:
                try:
                    db.append_log(log_entry)
                except Exception as log_err:
                    logger.warning("Failed to write prefetch log: %s", log_err)
            await task_event_bus.publish(task.id, "log", log_entry.model_dump(mode="json"))

        context_str = ""
        if context_blocks:
            joined_files = "\n\n".join(context_blocks)
            if language == "id":
                context_str = (
                    f"\n\n[Konteks File Otomatis Ditemukan]:\n{joined_files}\n\n"
                    "PETUNJUK: Konten file yang relevan di atas sudah disediakan. "
                    "Jika informasi ini sudah cukup untuk memperbaiki masalah, Anda DAPAT LANGSUNG menghasilkan JSON PatchSet final tanpa perlu memanggil tools lagi."
                )
            else:
                context_str = (
                    f"\n\n[Pre-fetched File Context]:\n{joined_files}\n\n"
                    "NOTE: The relevant file contents have been pre-fetched above. "
                    "If this information is sufficient to resolve the task, you may IMMEDIATELY output the final PatchSet JSON without making tool calls."
                )

        if language == "id":
            user_prompt = (
                f"Repository: {task.repo_full_name}\n"
                f"Judul Tugas: {task.title}\n"
                f"Deskripsi Tugas:\n{task.description}"
                f"{context_str}\n\n"
                "Silakan telusuri repositori menggunakan tools untuk mengidentifikasi masalah, "
                "verifikasi kode yang relevan, dan hasilkan JSON PatchSet final dengan ringkasan (summary) "
                "dan penjelasan (explanation) dalam Bahasa Indonesia."
            )
        else:
            user_prompt = (
                f"Repository: {task.repo_full_name}\n"
                f"Task Title: {task.title}\n"
                f"Task Description:\n{task.description}"
                f"{context_str}\n\n"
                "Please explore the repository using tools to locate the issue, verify the relevant code, "
                "and output the final PatchSet JSON."
            )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": sys_inst},
            {"role": "user", "content": user_prompt},
        ]

        tools = self._get_tools_schema()
        step_counter = 1 if prefetched else 0
        round_counter = 0

        while round_counter < self.MAX_TOOL_ROUNDS:
            round_counter += 1
            logger.info("OpenRouter task id=%s | Round %d/%d calling model %s", task.id, round_counter, self.MAX_TOOL_ROUNDS, self.model_name)

            data = await self._call_openrouter(messages=messages, tools=tools)
            choices = data.get("choices", [])
            if not choices:
                raise RuntimeError("Empty response received from OpenRouter.")

            message = choices[0].get("message", {})
            messages.append(message)

            tool_calls = message.get("tool_calls", [])
            text_tool_calls: list[dict[str, Any]] = []

            if not tool_calls:
                content_text = message.get("content", "") or ""
                text_tool_calls = self._extract_text_tool_calls(content_text)
                if not text_tool_calls:
                    # Truly final synthesis response
                    return await self._resolve_and_verify(content_text, task, messages)

            # Handle standard OpenAI tool_calls
            if tool_calls:
                for tc in tool_calls:
                    step_counter += 1
                    fn = tc.get("function", {})
                    tool_name = fn.get("name", "")
                    try:
                        tool_args = json.loads(fn.get("arguments", "{}"))
                    except Exception:
                        tool_args = {}

                    logger.info("OpenRouter Step %d: tool '%s' args=%s", step_counter, tool_name, tool_args)
                    tool_result = self._execute_tool(tool_name, tool_args)

                    log_entry = TaskLogEntry(
                        task_id=task.id,
                        step_number=step_counter,
                        tool_name=tool_name,
                        tool_input=tool_args,
                        tool_output=json.dumps(tool_result)[:4000],
                        created_at=datetime.now(timezone.utc),
                    )
                    if db:
                        try:
                            db.append_log(log_entry)
                        except Exception as log_err:
                            logger.warning("Failed to record task audit log: %s", log_err)
                    await task_event_bus.publish(task.id, "log", log_entry.model_dump(mode="json"))

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "name": tool_name,
                        "content": json.dumps({"result": tool_result}),
                    })
            # Handle text/XML tool_calls
            elif text_tool_calls:
                for pt in text_tool_calls:
                    step_counter += 1
                    tool_name = pt["name"]
                    tool_args = pt["arguments"]

                    logger.info("OpenRouter Step %d (text-parsed): tool '%s' args=%s", step_counter, tool_name, tool_args)
                    tool_result = self._execute_tool(tool_name, tool_args)

                    log_entry = TaskLogEntry(
                        task_id=task.id,
                        step_number=step_counter,
                        tool_name=tool_name,
                        tool_input=tool_args,
                        tool_output=json.dumps(tool_result)[:4000],
                        created_at=datetime.now(timezone.utc),
                    )
                    if db:
                        try:
                            db.append_log(log_entry)
                        except Exception as log_err:
                            logger.warning("Failed to record task audit log: %s", log_err)
                    await task_event_bus.publish(task.id, "log", log_entry.model_dump(mode="json"))

                    messages.append({
                        "role": "user",
                        "content": (
                            f"Tool '{tool_name}' executed. Output:\n"
                            f"```json\n{json.dumps(tool_result, indent=2)}\n```\n"
                            "Continue your exploration using tools if needed, or output your final PatchSet JSON if you have enough information."
                        ),
                    })

        # Max tool rounds reached -> request final synthesis
        messages.append({
            "role": "user",
            "content": "You have reached the maximum allowed tool exploration rounds. Provide your final PatchSet JSON immediately.",
        })
        final_data = await self._call_openrouter(messages=messages, tools=None)
        final_choices = final_data.get("choices", [])
        final_text = final_choices[0].get("message", {}).get("content", "") if final_choices else ""
        return await self._resolve_and_verify(final_text, task, messages)

    async def _resolve_and_verify(
        self,
        response_text: str,
        task: TaskRecord,
        messages: list[dict[str, Any]],
    ) -> PatchSet:
        current_text = response_text
        repair_attempt = 0

        while True:
            error_message: str | None = None
            candidate: PatchSet | None = None

            try:
                candidate = self._extract_patch_set(current_text, task.id)
                is_valid, verify_err = self.verify_patch_locally(candidate)
                if not is_valid:
                    error_message = verify_err
            except Exception as e:
                error_message = f"Invalid PatchSet format: {e}"

            if candidate is not None and error_message is None:
                logger.info("Task id=%s | OpenRouter PatchSet verified locally successfully.", task.id)
                return candidate

            if repair_attempt < self.MAX_REPAIR_ATTEMPTS:
                repair_attempt += 1
                logger.warning("Task id=%s | Verification failed: %s. Self-repair %d/%d", task.id, error_message, repair_attempt, self.MAX_REPAIR_ATTEMPTS)
                messages.append({
                    "role": "user",
                    "content": (
                        f"Your proposed patch failed local verification with error:\n{error_message}\n\n"
                        f"Please output a corrected, valid PatchSet JSON matching the schema."
                    ),
                })
                data = await self._call_openrouter(messages=messages, tools=None)
                choices = data.get("choices", [])
                current_text = choices[0].get("message", {}).get("content", "") if choices else ""
            else:
                if candidate is not None:
                    raise ValueError(f"PatchSet failed verification after {self.MAX_REPAIR_ATTEMPTS} repairs: {error_message}")
                raise ValueError(f"Failed to parse valid PatchSet JSON: {error_message}")
