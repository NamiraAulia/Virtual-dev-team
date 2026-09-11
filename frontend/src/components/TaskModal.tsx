import React, { useState } from 'react';
import {
  X,
  Plus,
  Play,
  GitFork,
  AlertCircle,
} from 'lucide-react';
import type { TaskCreateInput } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TaskCreateInput, autoRun: boolean) => void;
  isLoading: boolean;
  defaultRepo?: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  defaultRepo = 'NamiraAulia/Virtual-dev-team',
}) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repo, setRepo] = useState(defaultRepo);
  const [autoRun, setAutoRun] = useState(true);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError(t.taskModal.errTitleRequired);
      return;
    }
    if (!description.trim()) {
      setError(t.taskModal.errDescRequired);
      return;
    }
    if (!repo.trim() || !repo.includes('/')) {
      setError(t.taskModal.errRepoRequired);
      return;
    }

    setError(null);
    onSubmit(
      {
        title: title.trim(),
        description: description.trim(),
        repo_full_name: repo.trim(),
      },
      autoRun
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div
        className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                {t.taskModal.modalTitle}
              </h2>
              <p className="text-xs text-slate-500 font-sans">
                {t.taskModal.modalSubtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Repo Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <GitFork className="w-3.5 h-3.5 text-slate-500" />
                {t.taskModal.repoLabel}
              </span>
              <span className="text-[10px] font-normal text-slate-400 font-mono">
                {t.taskModal.repoHint}
              </span>
            </label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder={t.taskModal.repoPlaceholder}
              className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Task Title Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">
              {t.taskModal.titleLabel}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.taskModal.titlePlaceholder}
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Description / Stacktrace */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 flex items-center justify-between">
              <span>{t.taskModal.descLabel}</span>
              <span className="text-[10px] font-normal text-slate-400">
                {t.taskModal.descHint}
              </span>
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.taskModal.descPlaceholder}
              className="w-full text-xs font-mono px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Auto-Run Toggle */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Play className="w-4 h-4 text-indigo-600" />
              <div>
                <div className="text-xs font-bold text-slate-800">
                  {t.taskModal.autoRunTitle}
                </div>
                <div className="text-[11px] text-slate-500">
                  {t.taskModal.autoRunSubtitle}
                </div>
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {isLoading ? t.taskModal.creatingTaskBtn : t.taskModal.createTaskBtn}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
