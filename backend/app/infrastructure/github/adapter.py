from __future__ import annotations

"""
GitHub Adapter.

Wraps PyGithub to provide 3 AI-callable tools (listDirectory, readFile, searchCode)
and a PR creation pipeline for the approval flow.
"""

import base64
import logging

from github import Github, GithubException

from app.domain.patch import PatchAction

logger = logging.getLogger(__name__)

# Security guard: max file size the AI is allowed to read (100 KB)
MAX_FILE_SIZE_BYTES = 100 * 1024


class GitHubAdapter:
    """Adapter for interacting with a GitHub repository."""

    def __init__(self, token: str, repo_full_name: str) -> None:
        self._github = Github(token)
        self._repo = self._github.get_repo(repo_full_name)
        self.repo_full_name = repo_full_name
        self._file_cache: dict[str, dict] = {}

    def list_directory(self, path: str = "") -> list[dict]:
        """
        AI Tool: listDirectory
        List files and directories at the given path in the repository.

        Returns a list of dicts with 'name', 'type' ('file' | 'dir'), and 'path'.
        """
        try:
            contents = self._repo.get_contents(path)
            if not isinstance(contents, list):
                contents = [contents]

            return [
                {
                    "name": item.name,
                    "type": "dir" if item.type == "dir" else "file",
                    "path": item.path,
                    "size": item.size,
                }
                for item in contents
            ]
        except GithubException as e:
            logger.error("listDirectory failed for path='%s': %s", path, e)
            return [{"error": f"Failed to list directory '{path}': {e.data.get('message', str(e))}"}]

    def read_file(self, file_path: str) -> dict:
        """
        AI Tool: readFile
        Read the contents of a file from the repository.

        Enforces a 100KB size limit as a security guardrail.
        Returns a dict with 'path', 'content', and 'size'.
        """
        clean_path = file_path.strip().lstrip("/")
        if clean_path in self._file_cache:
            return self._file_cache[clean_path]

        try:
            file_content = self._repo.get_contents(clean_path)

            # Guard: reject files larger than 100KB
            if file_content.size > MAX_FILE_SIZE_BYTES:
                return {
                    "error": (
                        f"File '{clean_path}' is {file_content.size} bytes, "
                        f"exceeding the {MAX_FILE_SIZE_BYTES} byte limit. "
                        "Try reading a smaller file or a specific section."
                    )
                }

            # Decode content from base64
            content = base64.b64decode(file_content.content).decode("utf-8")

            res = {
                "path": file_content.path,
                "content": content,
                "size": file_content.size,
                "encoding": "utf-8",
            }
            self._file_cache[clean_path] = res
            return res
        except GithubException as e:
            logger.error("readFile failed for path='%s': %s", clean_path, e)
            return {"error": f"Failed to read file '{clean_path}': {e.data.get('message', str(e))}"}
        except UnicodeDecodeError:
            return {"error": f"File '{clean_path}' is not a valid UTF-8 text file (binary?)."}

    def prefetch_relevant_files(self, text: str) -> dict[str, str]:
        """
        Extract candidate file paths from stack traces or descriptions,
        and pre-fetch their contents to accelerate AI exploration.
        """
        import re

        # Regex to find typical repo file paths like backend/app/main.py, src/App.tsx, etc.
        pattern = r"(?:[\w\-.]+/)+[\w\-.]+\.(?:py|tsx|ts|js|jsx|json|html|css|yaml|yml|md|env|sql)"
        matches = set(re.findall(pattern, text))
        prefetched: dict[str, str] = {}

        for raw_path in matches:
            clean = raw_path.strip().lstrip("/")
            # Skip URLs or common false positives
            if any(clean.startswith(prefix) for prefix in ["http:", "https:", "git:", "node_modules/"]):
                continue

            file_res = self.read_file(clean)
            if "content" in file_res and not file_res.get("error"):
                prefetched[clean] = file_res["content"]
                continue

            # Try stripping leading segments (e.g. Virtual-dev-team/backend/app.py -> backend/app.py)
            parts = clean.split("/")
            if len(parts) > 1:
                subpath = "/".join(parts[1:])
                file_res2 = self.read_file(subpath)
                if "content" in file_res2 and not file_res2.get("error"):
                    prefetched[subpath] = file_res2["content"]

        return prefetched

    def search_code(self, query: str) -> list[dict]:
        """
        AI Tool: searchCode
        Search for code matching a query within the repository using GitHub Search API.

        Returns a list of dicts with 'path', 'name', and 'html_url'.
        Limited to top 10 results.
        """
        try:
            full_query = f"{query} repo:{self.repo_full_name}"
            results = self._github.search_code(full_query)

            items = []
            try:
                for idx, item in enumerate(results):
                    if idx >= 10:
                        break
                    items.append(
                        {
                            "path": item.path,
                            "name": item.name,
                            "html_url": item.html_url,
                            "repository": item.repository.full_name,
                        }
                    )
            except (IndexError, StopIteration):
                pass

            if not items:
                return [{"message": f"No results found for query: '{query}'"}]

            return items
        except GithubException as e:
            logger.error("searchCode failed for query='%s': %s", query, e)
            return [{"error": f"Search failed for '{query}': {e.data.get('message', str(e))}"}]
        except Exception as e:
            logger.error("searchCode unexpected error for query='%s': %s", query, e)
            return [{"message": f"No results found or search failed for '{query}': {str(e)}"}]

    #  PR Pipeline — used after human approval                           

    def create_branch(self, branch_name: str, base: str = "main") -> str:
        """
        Create a new branch from the specified base branch.
        Returns the SHA of the new branch head.
        """
        base_ref = self._repo.get_git_ref(f"heads/{base}")
        base_sha = base_ref.object.sha

        self._repo.create_git_ref(
            ref=f"refs/heads/{branch_name}",
            sha=base_sha,
        )
        logger.info("Created branch '%s' from '%s' (SHA: %s)", branch_name, base, base_sha)
        return base_sha

    def commit_changes(
        self,
        branch: str,
        patches: list[PatchAction],
        commit_message: str,
    ) -> str:
        """
        Apply a list of PatchActions to the branch by performing
        search-and-replace on each target file and committing the results.

        Returns the SHA of the new commit.
        """
        for patch in patches:
            # Read current file content from the branch
            file_content = self._repo.get_contents(patch.file_path, ref=branch)
            current_text = base64.b64decode(file_content.content).decode("utf-8")

            # Perform search-and-replace with whitespace normalization
            new_text = self._apply_search_replace(
                current_text, patch.search_block, patch.replace_block
            )

            if new_text == current_text:
                logger.warning(
                    "Patch for '%s' did not match any text — skipping. "
                    "search_block: %r",
                    patch.file_path,
                    patch.search_block[:80],
                )
                continue

            # Commit the updated file
            self._repo.update_file(
                path=patch.file_path,
                message=f"{commit_message}\n\n{patch.explanation}",
                content=new_text,
                sha=file_content.sha,
                branch=branch,
            )
            logger.info("Committed patch to '%s' on branch '%s'", patch.file_path, branch)

        # Return latest commit SHA on the branch
        branch_ref = self._repo.get_branch(branch)
        return branch_ref.commit.sha

    def create_pull_request(self, branch: str, title: str, body: str) -> str:
        """
        Create a Pull Request from the given branch to main.
        Returns the PR URL.
        """
        pr = self._repo.create_pull(
            title=title,
            body=body,
            head=branch,
            base="main",
        )
        logger.info("Created PR #%d: %s", pr.number, pr.html_url)
        return pr.html_url

    #  Internal helpers                                                  

    @staticmethod
    def _apply_search_replace(
        source: str, search_block: str, replace_block: str
    ) -> str:
        """
        Apply search-and-replace with whitespace normalization.

        First tries an exact match. If that fails, falls back to a
        normalized comparison (collapsing runs of whitespace) to handle
        minor formatting differences between AI output and actual file.
        """
        # Fast path: exact match
        if search_block in source:
            return source.replace(search_block, replace_block, 1)

        # Slow path: normalize whitespace and try again
        import re

        def normalize(text: str) -> str:
            return re.sub(r"\s+", " ", text.strip())

        normalized_search = normalize(search_block)
        lines = source.split("\n")

        # Sliding window over lines to find the matching block
        search_line_count = search_block.count("\n") + 1
        for i in range(len(lines) - search_line_count + 1):
            window = "\n".join(lines[i : i + search_line_count])
            if normalize(window) == normalized_search:
                # Replace this window with the replace_block
                before = "\n".join(lines[:i])
                after = "\n".join(lines[i + search_line_count :])
                parts = [p for p in [before, replace_block, after] if p]
                return "\n".join(parts)

        # No match found — return original
        return source
