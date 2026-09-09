import json
import unittest
from unittest.mock import MagicMock
from datetime import datetime, timezone

from google.genai import types

from app.domain.task import TaskRecord, TaskStatus
from app.domain.patch import PatchSet, PatchAction
from app.infrastructure.ai.gemini_engine import GeminiEngine
from app.infrastructure.github.adapter import GitHubAdapter


class TestGeminiEngine(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.mock_github = MagicMock(spec=GitHubAdapter)
        self.mock_github.repo_full_name = "test-owner/test-repo"
        self.mock_github.list_directory.return_value = [
            {"name": "main.py", "type": "file", "path": "main.py", "size": 120}
        ]
        self.mock_github.read_file.return_value = {
            "path": "main.py",
            "content": "def run():\n    print('error')",
            "size": 30,
            "encoding": "utf-8",
        }
        self.mock_github.search_code.return_value = [
            {"name": "main.py", "path": "main.py", "html_url": "https://github.com/test-owner/test-repo/blob/main/main.py"}
        ]

        self.sample_task = TaskRecord(
            id="123e4567-e89b-12d3-a456-426614174000",
            title="Fix print statement in main.py",
            description="Replace error log with info message",
            repo_full_name="test-owner/test-repo",
            status=TaskStatus.PENDING,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )

    def test_gemini_engine_initialization(self):
        engine = GeminiEngine(api_key="dummy-key", github_adapter=self.mock_github)
        self.assertEqual(engine.MODEL_NAME, "gemini-2.0-flash")
        self.assertEqual(engine.TEMPERATURE, 0.0)
        self.assertEqual(engine.MAX_TOOL_ROUNDS, 5)

        tools = engine._get_tools()
        self.assertEqual(len(tools), 3)
        tool_names = [fn.__name__ for fn in tools]
        self.assertIn("list_directory", tool_names)
        self.assertIn("read_file", tool_names)
        self.assertIn("search_code", tool_names)

    def test_tool_execution(self):
        engine = GeminiEngine(api_key="dummy-key", github_adapter=self.mock_github)

        res_list = engine._execute_tool("list_directory", {"path": "src"})
        self.mock_github.list_directory.assert_called_once_with(path="src")
        self.assertEqual(res_list[0]["name"], "main.py")

        res_read = engine._execute_tool("read_file", {"file_path": "main.py"})
        self.mock_github.read_file.assert_called_once_with(file_path="main.py")
        self.assertIn("def run", res_read["content"])

        res_search = engine._execute_tool("search_code", {"query": "error"})
        self.mock_github.search_code.assert_called_once_with(query="error")
        self.assertEqual(len(res_search), 1)

    def test_patch_set_extraction(self):
        engine = GeminiEngine(api_key="dummy-key", github_adapter=self.mock_github)

        json_output = """
        ```json
        {
          "summary": "Fix print statement to output success message",
          "actions": [
            {
              "file_path": "main.py",
              "search_block": "print('error')",
              "replace_block": "print('success')",
              "explanation": "Update logging message to success"
            }
          ]
        }
        ```
        """
        patch_set = engine._extract_patch_set(json_output, task_id="test-task-1")
        self.assertEqual(patch_set.task_id, "test-task-1")
        self.assertEqual(patch_set.summary, "Fix print statement to output success message")
        self.assertEqual(len(patch_set.actions), 1)
        self.assertEqual(patch_set.actions[0].file_path, "main.py")
        self.assertEqual(patch_set.actions[0].search_block, "print('error')")
        self.assertEqual(patch_set.actions[0].replace_block, "print('success')")

    async def test_run_exploration_autonomous_loop(self):
        mock_client = MagicMock()

        # Turn 1: AI calls search_code
        call_part = types.Part(function_call=types.FunctionCall(name="search_code", args={"query": "error"}))
        resp1 = MagicMock()
        resp1.candidates = [MagicMock(content=types.Content(role="model", parts=[call_part]))]
        resp1.function_calls = [types.FunctionCall(name="search_code", args={"query": "error"})]
        resp1.text = None

        # Turn 2: AI outputs final PatchSet JSON
        final_json = json.dumps({
            "summary": "Fixed error print in main.py",
            "actions": [
                {
                    "file_path": "main.py",
                    "search_block": "print('error')",
                    "replace_block": "print('info')",
                    "explanation": "Corrected log level",
                }
            ]
        })
        resp2 = MagicMock()
        resp2.candidates = [MagicMock(content=types.Content(role="model", parts=[types.Part.from_text(text=final_json)]))]
        resp2.function_calls = None
        resp2.text = final_json

        mock_client.models.generate_content.side_effect = [resp1, resp2]

        mock_db = MagicMock()
        engine = GeminiEngine(api_key="dummy-key", github_adapter=self.mock_github, client=mock_client)

        patch_set = await engine.run_exploration(self.sample_task, db=mock_db)

        self.assertEqual(patch_set.task_id, self.sample_task.id)
        self.assertEqual(len(patch_set.actions), 1)
        self.assertEqual(patch_set.actions[0].replace_block, "print('info')")

        # Verify tool was called
        self.mock_github.search_code.assert_called_once_with(query="error")
        # Verify audit log was recorded
        mock_db.append_log.assert_called_once()
        self.assertEqual(mock_client.models.generate_content.call_count, 2)

    async def test_guardrail_5_rounds_limit(self):
        mock_client = MagicMock()

        # Create 5 rounds of tool calling
        call_part = types.Part(function_call=types.FunctionCall(name="list_directory", args={"path": ""}))
        tool_resp = MagicMock()
        tool_resp.candidates = [MagicMock(content=types.Content(role="model", parts=[call_part]))]
        tool_resp.function_calls = [types.FunctionCall(name="list_directory", args={"path": ""})]
        tool_resp.text = None

        final_json = json.dumps({
            "summary": "Forced synthesis after 5 rounds",
            "actions": [
                {
                    "file_path": "main.py",
                    "search_block": "print('error')",
                    "replace_block": "print('fallback')",
                    "explanation": "Synthesized patch from 5 rounds of data",
                }
            ]
        })
        final_resp = MagicMock()
        final_resp.candidates = [MagicMock(content=types.Content(role="model", parts=[types.Part.from_text(text=final_json)]))]
        final_resp.function_calls = None
        final_resp.text = final_json

        # 5 tool calling responses + 1 final forced synthesis response
        mock_client.models.generate_content.side_effect = [tool_resp] * 5 + [final_resp]

        engine = GeminiEngine(api_key="dummy-key", github_adapter=self.mock_github, client=mock_client)
        patch_set = await engine.run_exploration(self.sample_task)

        self.assertEqual(patch_set.summary, "Forced synthesis after 5 rounds")
        self.assertEqual(len(patch_set.actions), 1)
        # Verify exactly 6 generate_content calls (5 exploration turns + 1 final forced turn)
        self.assertEqual(mock_client.models.generate_content.call_count, 6)


if __name__ == "__main__":
    unittest.main()
