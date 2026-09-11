import React from 'react';
import {
  CheckCircle2,
  Code2,
  Search,
  GitPullRequest,
  Lock,
} from 'lucide-react';
import type { TaskStatus } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface PipelineStagesProps {
  status: TaskStatus | undefined;
  hasPatches: boolean;
  hasPr: boolean;
}

export const PipelineStages: React.FC<PipelineStagesProps> = ({
  status,
  hasPatches,
  hasPr,
}) => {
  const { t } = useLanguage();

  // Determine state of each stage
  const isStage1Done = !!status;
  const isStage2Active = status === 'exploring';
  const isStage2Done = status === 'patch_ready' || status === 'approved' || status === 'pr_created';
  const isStage3Active = (status === 'patch_ready' || hasPatches) && !hasPr && status !== 'approved' && status !== 'pr_created';
  const isStage3Done = status === 'approved' || status === 'pr_created' || hasPr;
  const isStage4Done = status === 'approved' || status === 'pr_created' || hasPr;
  const isStage4Active = status === 'patch_ready' && !hasPr;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
      {/* Stage 01: Telemetry Ingest */}
      <div
        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
          isStage1Done
            ? 'bg-white border-emerald-200 shadow-xs'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              Stage 01
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-100">
              {t.stages.stage01.time}
            </span>
          </div>
          <div className="font-bold text-xs text-slate-900 truncate">
            {t.stages.stage01.title}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {t.stages.stage01.desc}
          </div>
        </div>
      </div>

      {/* Stage 02: AST Exploration */}
      <div
        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
          isStage2Active
            ? 'bg-indigo-50/70 border-indigo-300 shadow-xs ring-2 ring-indigo-500/20'
            : isStage2Done
            ? 'bg-white border-emerald-200 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 opacity-75'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            isStage2Active
              ? 'bg-indigo-100 border-indigo-300 text-indigo-700 animate-pulse'
              : isStage2Done
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          }`}
        >
          {isStage2Done ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Code2 className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              Stage 02
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isStage2Active
                  ? 'text-indigo-700 bg-indigo-100 border-indigo-200 animate-pulse'
                  : 'text-emerald-700 bg-emerald-50 border-emerald-100'
              }`}
            >
              {isStage2Active ? t.stages.stage02.activeBadge : t.stages.stage02.time}
            </span>
          </div>
          <div className="font-bold text-xs text-slate-900 truncate">
            {t.stages.stage02.title}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {t.stages.stage02.desc}
          </div>
        </div>
      </div>

      {/* Stage 03: RCA & Diff Review */}
      <div
        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
          isStage3Active
            ? 'bg-indigo-50/60 border-indigo-300 shadow-xs'
            : isStage3Done
            ? 'bg-white border-emerald-200 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 opacity-75'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            isStage3Active
              ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
              : isStage3Done
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          }`}
        >
          {isStage3Done ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              Stage 03
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isStage3Active
                  ? 'text-indigo-700 bg-indigo-100 border-indigo-200'
                  : isStage3Done
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-slate-500 bg-slate-100 border-slate-200'
              }`}
            >
              {isStage3Active
                ? t.stages.stage03.statusActive
                : isStage3Done
                ? t.stages.stage03.statusVerified
                : t.stages.stage03.statusPending}
            </span>
          </div>
          <div className="font-bold text-xs text-slate-900 truncate">
            {t.stages.stage03.title}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {t.stages.stage03.desc}
          </div>
        </div>
      </div>

      {/* Stage 04: PR Deployment */}
      <div
        className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
          isStage4Done
            ? 'bg-white border-emerald-200 shadow-xs'
            : isStage4Active
            ? 'bg-amber-50/70 border-amber-300 shadow-xs'
            : 'bg-slate-50/60 border-slate-200 opacity-75'
        }`}
      >
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
            isStage4Done
              ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
              : isStage4Active
              ? 'bg-amber-100 border-amber-300 text-amber-700'
              : 'bg-slate-100 border-slate-200 text-slate-400'
          }`}
        >
          {isStage4Done ? (
            <GitPullRequest className="w-4 h-4 text-emerald-600" />
          ) : isStage4Active ? (
            <GitPullRequest className="w-4 h-4 text-amber-600" />
          ) : (
            <Lock className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase">
              Stage 04
            </span>
            <span
              className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded border ${
                isStage4Done
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : isStage4Active
                  ? 'text-amber-700 bg-amber-100 border-amber-200'
                  : 'text-slate-500 bg-slate-100 border-slate-200'
              }`}
            >
              {isStage4Done
                ? t.stages.stage04.statusDeployed
                : isStage4Active
                ? t.stages.stage04.statusReady
                : t.stages.stage04.statusLocked}
            </span>
          </div>
          <div className="font-bold text-xs text-slate-900 truncate">
            {t.stages.stage04.title}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {isStage4Done
              ? t.stages.stage04.descCreated
              : t.stages.stage04.descWaiting}
          </div>
        </div>
      </div>
    </div>
  );
};
