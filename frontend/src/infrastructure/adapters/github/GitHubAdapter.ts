import { Octokit } from "octokit";

export interface DirectoryItem {
  name: string;
  path: string;
  type: "file" | "dir" | "submodule" | "symlink";
  size?: number;
  sha?: string;
}

export interface FileContentResult {
  path: string;
  name: string;
  size: number;
  content: string;
  encoding: string;
  sha: string;
}

export interface CodeSearchResultItem {
  name: string;
  path: string;
  sha: string;
  html_url: string;
  repository: {
    id: number;
    name: string;
    full_name: string;
    owner: string;
  };
}

export interface GitHubAdapterConfig {
  auth?: string;
}

export const MAX_FILE_SIZE_BYTES = 100 * 1024;

export class GitHubAdapter {
  private octokit: Octokit;

  constructor(config?: GitHubAdapterConfig) {
    const nodeProcess = typeof globalThis !== "undefined" ? (globalThis as { process?: { env?: Record<string, string> } }).process : undefined;
    const token =
      config?.auth ||
      (typeof import.meta !== "undefined" && import.meta.env
        ? (import.meta.env.VITE_GITHUB_PERSONAL_ACCESS_TOKEN as string | undefined)
        : undefined) ||
      (nodeProcess?.env
        ? nodeProcess.env.GITHUB_PERSONAL_ACCESS_TOKEN || nodeProcess.env.VITE_GITHUB_PERSONAL_ACCESS_TOKEN
        : undefined);

    this.octokit = new Octokit({
      auth: token,
    });
  }

  async listDirectory(
    owner: string,
    repo: string,
    path: string = ""
  ): Promise<DirectoryItem[]> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
      });

      if (!Array.isArray(response.data)) {
        const item = response.data as {
          name: string;
          path: string;
          type: string;
          size?: number;
          sha?: string;
        };
        return [
          {
            name: item.name,
            path: item.path,
            type: (item.type as DirectoryItem["type"]) || "file",
            size: item.size,
            sha: item.sha,
          },
        ];
      }

      return response.data.map((item) => ({
        name: item.name,
        path: item.path,
        type: (item.type as DirectoryItem["type"]) || "file",
        size: item.size,
        sha: item.sha,
      }));
    } catch (error: any) {
      this.handleError(`listDirectory(owner="${owner}", repo="${repo}", path="${path}")`, error);
      throw error;
    }
  }

  async readFile(
    owner: string,
    repo: string,
    filePath: string
  ): Promise<FileContentResult> {
    try {
      const response = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path: filePath,
      });

      const data = response.data;

      if (Array.isArray(data) || data.type !== "file") {
        throw new Error(
          `Path '${filePath}' bukan file yang valid (ditemukan tipe: ${Array.isArray(data) ? "directory" : data.type}).`
        );
      }

      // Guardrail: validasi ukuran file
      if (typeof data.size === "number" && data.size > MAX_FILE_SIZE_BYTES) {
        throw new Error(
          `Guardrail violation: Ukuran file '${filePath}' (${data.size} bytes) melebihi batas maksimal ${MAX_FILE_SIZE_BYTES} bytes (100 KB).`
        );
      }

      // Decode base64 content
      let decodedContent = "";
      if (data.content && data.encoding === "base64") {
        decodedContent = this.decodeBase64(data.content);
      } else if (data.content) {
        decodedContent = data.content;
      }

      return {
        path: data.path,
        name: data.name,
        size: data.size,
        content: decodedContent,
        encoding: "utf-8",
        sha: data.sha,
      };
    } catch (error: any) {
      this.handleError(`readFile(owner="${owner}", repo="${repo}", filePath="${filePath}")`, error);
      throw error;
    }
  }


  async searchCode(
    owner: string,
    repo: string,
    query: string
  ): Promise<CodeSearchResultItem[]> {
    try {
      const q = `${query} repo:${owner}/${repo}`;
      const response = await this.octokit.rest.search.code({
        q,
        per_page: 10,
      });

      return response.data.items.map((item) => ({
        name: item.name,
        path: item.path,
        sha: item.sha,
        html_url: item.html_url,
        repository: {
          id: item.repository.id,
          name: item.repository.name,
          full_name: item.repository.full_name,
          owner: item.repository.owner.login,
        },
      }));
    } catch (error: any) {
      this.handleError(`searchCode(owner="${owner}", repo="${repo}", query="${query}")`, error);
      throw error;
    }
  }

  private decodeBase64(base64Str: string): string {
    const cleanStr = base64Str.replace(/\s/g, "");
    if (typeof atob === "function") {
      const binaryString = atob(cleanStr);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }
    
    const globalBuffer = (globalThis as { Buffer?: { from: (str: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    if (globalBuffer) {
      return globalBuffer.from(cleanStr, "base64").toString("utf-8");
    }

    throw new Error("Tidak dapat menemukan fungsi decoder Base64 di runtime ini.");
  }

  private handleError(context: string, error: any): void {
    const status = error.status || error.response?.status;
    const message = error.message || "Unknown GitHub API Error";

    if (status === 404) {
      console.warn(`[GitHubAdapter 404 Not Found] ${context}: ${message}`);
    } else if (status === 403 || status === 429) {
      console.error(
        `[GitHubAdapter Rate Limit / Forbidden (${status})] ${context}: Pastikan token valid dan memiliki kuota rate limit cukup.`
      );
    } else if (status === 401) {
      console.error(`[GitHubAdapter 401 Unauthorized] ${context}: Personal Access Token tidak valid atau kadaluarsa.`);
    } else {
      console.error(`[GitHubAdapter Error] ${context}: ${message}`);
    }
  }
}
