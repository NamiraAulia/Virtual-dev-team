import { useState, useEffect } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import {
  GitPullRequest,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { api } from './api/client';
import type { TaskCreateInput, Task } from './types';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { PipelineStages } from './components/PipelineStages';
import { LiveTurnBanner } from './components/LiveTurnBanner';
import { RCAPanel } from './components/RCAPanel';
import { DiffViewer } from './components/DiffViewer';
import { ActionControls } from './components/ActionControls';
import { TaskModal } from './components/TaskModal';
import { TaskList } from './components/TaskList';
import { LiveActivityFeed } from './components/LiveActivityFeed';
import { SentryModal } from './components/SentryModal';
import { LanguageProvider, useLanguage } from './context/LanguageContext';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DashboardContent() {
  const qc = useQueryClient();
  const { language, t } = useLanguage();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedModel, setSelectedModelState] = useState<string>(() => {
    return localStorage.getItem('patchops_ai_model') || 'gemini-2.0-flash';
  });

  const setSelectedModel = (modelId: string) => {
    setSelectedModelState(modelId);
    try {
      localStorage.setItem('patchops_ai_model', modelId);
    } catch {
      // Ignore localStorage write error
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSentryModalOpen, setIsSentryModalOpen] = useState(false);
  const [isBackendConnected, setIsBackendConnected] = useState(true);
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'logs' | 'prs'>('dashboard');

  // 1. Fetch all tasks
  const { data: tasks = [], isLoading: isTasksLoading } = useQuery<Task[]>({
    queryKey: ['tasks'],
    queryFn: api.getTasks,
    refetchInterval: 2500,
  });

  // 2. Health check
  useEffect(() => {
    const check = async () => {
      try {
        await api.checkHealth();
        setIsBackendConnected(true);
      } catch {
        setIsBackendConnected(false);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut Ctrl+N / Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Auto-select first task if none selected
  useEffect(() => {
    if (!selectedTaskId && tasks.length > 0) {
      setSelectedTaskId(tasks[0].id);
    }
  }, [tasks, selectedTaskId]);

  // 3. Fetch active task detail & patches
  const { data: taskDetail } = useQuery({
    queryKey: ['task', selectedTaskId],
    queryFn: () => (selectedTaskId ? api.getTask(selectedTaskId) : null),
    enabled: !!selectedTaskId,
    refetchInterval: (query) =>
      query.state.data?.task?.status === 'exploring' ? 1200 : false,
  });

  // 4. Fetch live audit logs for the selected task
  const { data: taskLogs = [], isLoading: isLogsLoading } = useQuery({
    queryKey: ['task_logs', selectedTaskId],
    queryFn: () => (selectedTaskId ? api.getTaskLogs(selectedTaskId) : []),
    enabled: !!selectedTaskId,
    refetchInterval: 1200,
  });

  const activeTask = taskDetail?.task || tasks.find((t) => t.id === selectedTaskId);
  const activePatches = taskDetail?.patches || [];
  const isExploring = activeTask?.status === 'exploring';

  // Mutations
  const createMutation = useMutation({
    mutationFn: async ({ data }: { data: TaskCreateInput; autoRun: boolean }) => {
      return await api.createTask(data);
    },
    onSuccess: (newTask, { autoRun }) => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      setSelectedTaskId(newTask.id);
      if (autoRun) {
        runMutation.mutate({ taskId: newTask.id, language, model: selectedModel });
      }
    },
  });

  const runMutation = useMutation({
    mutationFn: ({ taskId, language, model }: { taskId: string; language: string; model: string }) =>
      api.runTask(taskId, language, model),
    onMutate: async ({ taskId }) => {
      qc.setQueryData(['task', taskId], (old: any) => {
        if (!old) return old;
        return { ...old, task: { ...old.task, status: 'exploring' } };
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', selectedTaskId] });
      qc.invalidateQueries({ queryKey: ['task_logs', selectedTaskId] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: ({ taskId, comment, language }: { taskId: string; comment?: string; language: string }) =>
      api.approveTask(taskId, comment, language),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', selectedTaskId] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ taskId, reason }: { taskId: string; reason?: string }) =>
      api.rejectTask(taskId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['task', selectedTaskId] });
    },
  });

  const activeRepo = activeTask?.repo_full_name.split('/')[1] || activeTask?.repo_full_name || 'payment-gateway';

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-900">
      {/* Left Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        isBackendConnected={isBackendConnected}
        selectedModel={selectedModel}
        onModelChange={setSelectedModel}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <Header
          onNewTaskClick={() => setIsModalOpen(true)}
          onSentryClick={() => setIsSentryModalOpen(true)}
          isBackendConnected={isBackendConnected}
          activeRepo={activeRepo}
        />

        {/* Workspace Body */}
        <main className="flex-1 p-6 space-y-5 overflow-y-auto">
          {/* Top Stage Pipeline Stepper */}
          <PipelineStages
            status={activeTask?.status}
            hasPatches={activePatches.length > 0}
            hasPr={!!activeTask?.pr_number}
          />

          {/* Tab 1: Command Board (Main Reference Design) */}
          {currentTab === 'dashboard' && (
            <div className="space-y-5">
              {/* Live Turn & Telemetry Banner */}
              <LiveTurnBanner
                status={activeTask?.status}
                logs={taskLogs}
                isExploring={isExploring}
              />

              {/* Task Switcher Pill Bar */}
              <div className="flex items-center justify-between bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-mono shadow-xs">
                <div className="flex items-center gap-2 overflow-x-auto max-w-full">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">
                    {t.commandBoard.activeTaskLabel}
                  </span>
                  {tasks.map((taskItem) => (
                    <button
                      key={taskItem.id}
                      onClick={() => setSelectedTaskId(taskItem.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium truncate max-w-[200px] transition-all cursor-pointer ${
                        taskItem.id === selectedTaskId
                          ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {taskItem.title}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-bold text-xs shrink-0 pl-3 border-l border-slate-200 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.commandBoard.newButton}</span>
                </button>
              </div>

              {/* 2-Column Split Workspace */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Left Column (5 Cols): Incident & RCA Diagnostics */}
                <div className="lg:col-span-5 space-y-4">
                  <RCAPanel
                    task={activeTask}
                    patches={activePatches}
                    logs={taskLogs}
                  />
                </div>

                {/* Right Column (7 Cols): Visual Git Diff & Decision Gate */}
                <div className="lg:col-span-7 space-y-4">
                  <DiffViewer
                    patches={activePatches}
                    taskTitle={activeTask?.title}
                  />

                  <ActionControls
                    task={activeTask}
                    patches={activePatches}
                    onRun={() => activeTask && runMutation.mutate({ taskId: activeTask.id, language, model: selectedModel })}
                    onApprove={(comment) =>
                      activeTask &&
                      approveMutation.mutate({ taskId: activeTask.id, comment, language })
                    }
                    onReject={(reason) =>
                      activeTask &&
                      rejectMutation.mutate({ taskId: activeTask.id, reason })
                    }
                    isRunLoading={runMutation.isPending}
                    isApproveLoading={approveMutation.isPending}
                    isRejectLoading={rejectMutation.isPending}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Audit & Activity Logs */}
          {currentTab === 'logs' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-1">
                <TaskList
                  tasks={tasks}
                  selectedTaskId={selectedTaskId}
                  onSelectTask={setSelectedTaskId}
                  onNewTaskClick={() => setIsModalOpen(true)}
                  isLoading={isTasksLoading}
                />
              </div>
              <div className="lg:col-span-2">
                <LiveActivityFeed
                  logs={taskLogs}
                  isExploring={isExploring}
                  isLoading={isLogsLoading}
                />
              </div>
            </div>
          )}

          {/* Tab 3: PR & Patch History */}
          {currentTab === 'prs' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <GitPullRequest className="w-5 h-5 text-indigo-600" />
                  <h2 className="text-sm font-bold text-slate-900">
                    {t.commandBoard.prSectionTitle}
                  </h2>
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {tasks.filter((taskItem) => taskItem.status === 'approved' || taskItem.status === 'pr_created' || taskItem.pr_number).length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 font-mono">
                    {t.commandBoard.noApprovedPrs}
                  </div>
                ) : (
                  tasks
                    .filter((taskItem) => taskItem.status === 'approved' || taskItem.status === 'pr_created' || taskItem.pr_number)
                    .map((taskItem) => (
                      <div
                        key={taskItem.id}
                        className="py-3 flex items-center justify-between flex-wrap gap-2 text-xs font-mono"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{taskItem.title}</div>
                          <div className="text-[11px] text-slate-500">
                            {taskItem.repo_full_name} • PR #{taskItem.pr_number || '123'}
                          </div>
                        </div>

                        {taskItem.pr_url && (
                          <a
                            href={taskItem.pr_url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 text-indigo-700 rounded-lg border border-indigo-200 font-bold hover:bg-indigo-100"
                          >
                            <span>{t.commandBoard.openOnGithub}</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Task Creation Modal */}
      <TaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={(data, autoRun) => createMutation.mutate({ data, autoRun })}
        isLoading={createMutation.isPending}
        defaultRepo={activeTask?.repo_full_name || 'NamiraAulia/Virtual-dev-team'}
      />

      <SentryModal
        isOpen={isSentryModalOpen}
        onClose={() => setIsSentryModalOpen(false)}
        onTestTriggered={() => {
          qc.invalidateQueries({ queryKey: ['tasks'] });
        }}
      />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <DashboardContent />
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;
