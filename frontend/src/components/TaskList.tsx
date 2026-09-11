import React from 'react';
import {
  Clock,
  CheckCircle2,
  XCircle,
  RotateCw,
  AlertCircle,
  Plus,
} from 'lucide-react';
import type { Task, TaskStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
  onNewTaskClick: () => void;
  isLoading: boolean;
}

const statusConfig: Record<
  TaskStatus,
  { bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending: {
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    icon: <Clock className="w-3 h-3 text-slate-500" />,
  },
  exploring: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
    icon: <RotateCw className="w-3 h-3 text-indigo-600 animate-spin" />,
  },
  patch_ready: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
  },
  approved: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
  },
  pr_created: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3 h-3 text-emerald-600" />,
  },
  rejected: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: <XCircle className="w-3 h-3 text-rose-600" />,
  },
  failed: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
    icon: <AlertCircle className="w-3 h-3 text-rose-600" />,
  },
};

export const TaskList: React.FC<TaskListProps> = ({
  tasks,
  selectedTaskId,
  onSelectTask,
  onNewTaskClick,
  isLoading,
}) => {
  const { t, format } = useLanguage();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-mono">
            {format(t.taskList.queueTitle, { count: tasks.length })}
          </h2>
        </div>
        <button
          onClick={onNewTaskClick}
          className="p-1 rounded hover:bg-slate-200/70 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          title={t.taskList.createTaskTooltip}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Task Items */}
      <div className="divide-y divide-slate-100 max-h-[360px] overflow-y-auto">
        {isLoading && tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-mono">
            {t.taskList.loading}
          </div>
        ) : tasks.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-400 font-mono">
            {t.taskList.empty}
          </div>
        ) : (
          tasks.map((task) => {
            const isSelected = task.id === selectedTaskId;
            const config = statusConfig[task.status] || statusConfig.pending;
            const label = t.taskList.statuses[task.status] || task.status;
            const isSentry =
              task.description.toLowerCase().includes('sentry') ||
              task.title.toLowerCase().includes('sentry') ||
              task.title.startsWith('TypeError:') ||
              task.title.startsWith('Unhandled');

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className={`p-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-indigo-50/70 border-l-3 border-indigo-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 flex flex-col gap-1">
                    {isSentry && (
                      <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded w-max">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                        ⚡ SENTRY ALERT
                      </span>
                    )}
                    <span className="text-xs font-bold text-slate-900 line-clamp-1">
                      {task.title}
                    </span>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border shrink-0 ${config.bg} ${config.text} ${config.border}`}
                  >
                    {config.icon}
                    {label}
                  </span>
                </div>

                <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-slate-500">
                  <span className="truncate max-w-[150px]">
                    {task.repo_full_name.split('/')[1] || task.repo_full_name}
                  </span>
                  <span>{new Date(task.created_at).toLocaleTimeString()}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
