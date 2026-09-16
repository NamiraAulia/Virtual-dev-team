export type TaskStatus =
  | 'pending'
  | 'exploring'
  | 'patch_ready'
  | 'approved'
  | 'pr_created'
  | 'rejected'
  | 'failed';

export interface Task {
  id: string;
  title: string;
  description: string;
  repo_full_name: string;
  status: TaskStatus;
  pr_number?: number | string | null;
  pr_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PatchRecord {
  id: string;
  task_id: string;
  file_path: string;
  search_block: string;
  replace_block: string;
  explanation: string;
  summary?: string;
  actions?: PatchAction[];
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface PatchAction {
  file_path: string;
  search_block: string;
  replace_block: string;
  explanation: string;
}

// Aliases for convenience
export type Patch = PatchRecord;
export type TaskLog = TaskLogEntry;

export interface TaskLogEntry {
  id: string;
  task_id: string;
  step_number: number;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: string;
  created_at: string;
}

export interface TaskDetail {
  task: Task;
  patches: PatchRecord[];
}

export interface TaskCreateInput {
  title: string;
  description: string;
  repo_full_name: string;
}

export interface ApproveResponse {
  task: Task;
  pr_url?: string;
  pr_number?: number | string;
}
