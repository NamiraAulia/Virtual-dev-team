import axios from 'axios';
import type {
  Task,
  TaskDetail,
  TaskCreateInput,
  TaskLogEntry,
  ApproveResponse,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? '/api/v1'
    : 'http://localhost:8000/api/v1');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 2 minutes default timeout
});

export const api = {
  // Fetch all tasks
  getTasks: async (): Promise<Task[]> => {
    const response = await apiClient.get<Task[]>('/tasks');
    return response.data;
  },

  // Fetch task detail with patches
  getTask: async (taskId: string): Promise<TaskDetail> => {
    const response = await apiClient.get<TaskDetail>(`/tasks/${taskId}`);
    return response.data;
  },

  // Create new task
  createTask: async (payload: TaskCreateInput): Promise<Task> => {
    const response = await apiClient.post<Task>('/tasks', payload);
    return response.data;
  },

  // Trigger autonomous AI exploration (with 3-minute timeout for multi-turn agentic loop)
  runTask: async (taskId: string, language: string = 'en', model: string = 'gemini-flash-latest'): Promise<Task> => {
    const response = await apiClient.post<Task>(
      `/tasks/${taskId}/run?language=${encodeURIComponent(language)}&model=${encodeURIComponent(model)}`,
      null,
      {
        timeout: 180000,
      }
    );
    return response.data;
  },

  // Approve patches & create PR
  approveTask: async (taskId: string, comment?: string, language: string = 'en'): Promise<ApproveResponse> => {
    const response = await apiClient.post<ApproveResponse>(`/tasks/${taskId}/approve?language=${encodeURIComponent(language)}`, { comment }, {
      timeout: 60000,
    });
    return response.data;
  },


  // Reject task
  rejectTask: async (taskId: string, reason?: string): Promise<Task> => {
    const response = await apiClient.post<Task>(`/tasks/${taskId}/reject`, { reason });
    return response.data;
  },

  // Reset task back to pending
  resetTask: async (taskId: string): Promise<Task> => {
    const response = await apiClient.post<Task>(`/tasks/${taskId}/reset`);
    return response.data;
  },

  // Get audit logs for task
  getTaskLogs: async (taskId: string): Promise<TaskLogEntry[]> => {
    const response = await apiClient.get<TaskLogEntry[]>(`/tasks/${taskId}/logs`);
    return response.data;
  },

  // Get SSE stream URL for real-time task logs
  getTaskStreamUrl: (taskId: string): string => {
    return `${API_BASE_URL}/tasks/${taskId}/stream`;
  },

  // Health check
  checkHealth: async (): Promise<{ status: string; message: string }> => {
    try {
      const response = await apiClient.get('/health');
      return response.data;
    } catch {
      const response = await axios.get('http://localhost:8000/health');
      return response.data;
    }
  },

};

