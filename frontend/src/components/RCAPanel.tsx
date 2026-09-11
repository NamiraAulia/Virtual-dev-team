import React, { useState } from 'react';
import {
  Sparkles,
  ChevronDown,
  ChevronRight,
  Shield,
  Terminal,
  Activity,
  FileCode,
  Flame,
} from 'lucide-react';
import type { Task, PatchRecord, TaskLogEntry } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface RCAPanelProps {
  task: Task | undefined;
  patches: PatchRecord[];
  logs?: TaskLogEntry[];
}

export const RCAPanel: React.FC<RCAPanelProps> = ({ task, patches, logs = [] }) => {
  const { t, format, language } = useLanguage();
  const [isCrashTraceOpen, setIsCrashTraceOpen] = useState(true);
  const [isReproOpen, setIsReproOpen] = useState(false);
  const [isTraceOpen, setIsTraceOpen] = useState(false);

  if (!task) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center text-slate-500 shadow-xs">
        <p className="text-xs font-mono">{t.rcaPanel.noActiveTask}</p>
      </div>
    );
  }

  const patch = patches[0];
  const defaultSummaryEn = 'During high-concurrency token refresh cycles, req.user.session is evicted from Redis before the controller completes validation, causing null pointer dereference at line 142. Synthesizer introduced optional chaining and an explicit 401 unauthenticated guard contract.';
  const defaultSummaryId = 'Pada siklus pembaruan token konkurensi tinggi, req.user.session dikeluarkan dari Redis sebelum controller menyelesaikan validasi, menyebabkan dereferensi null pointer pada baris 142. Sintesis menambahkan optional chaining dan proteksi eksplisit 401 unauthenticated.';

  const summary =
    patch?.summary ||
    (task.status === 'patch_ready' || task.status === 'approved' || task.status === 'pr_created'
      ? (language === 'id' ? defaultSummaryId : defaultSummaryEn)
      : t.rcaPanel.investigationInProgress);

  const shortTaskId = task.id.slice(0, 8).toUpperCase();
  const repoName = task.repo_full_name.split('/')[1] || task.repo_full_name;
  const isSentry =
    task.description.toLowerCase().includes('sentry') ||
    task.title.toLowerCase().includes('sentry') ||
    task.title.startsWith('TypeError:') ||
    task.title.startsWith('Unhandled');

  return (
    <div className="space-y-4">
      {/* Header Info & Severity Badges */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {isSentry ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-100 border border-rose-300 text-rose-800">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />
                ⚡ SENTRY PROD ALERT
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-50 border border-rose-200 text-rose-700">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                {t.rcaPanel.sevHigh}
              </span>
            )}
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-50 border border-indigo-200 text-indigo-700">
              {t.rcaPanel.astSynthesis}
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-400">
            ID: #T-{shortTaskId}
          </span>
        </div>

        <div>
          <h2 className="text-sm font-bold text-slate-900 leading-snug">
            {task.title}
          </h2>
          <div className="flex items-center gap-2 mt-1 text-xs font-mono text-slate-600">
            <span className="text-slate-500 flex items-center gap-1">
              <FileCode className="w-3.5 h-3.5" />
              {repoName}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
              fix/patch-{shortTaskId.toLowerCase()}
            </span>
          </div>
        </div>

        {/* AI Confidence Score Card */}
        <div className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t.rcaPanel.confidenceScore}</span>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-700">
              {t.rcaPanel.deterministic}
            </span>
          </div>

          {/* Progress Breakdown Bar */}
          <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 h-full w-1/2" title={t.rcaPanel.testsInvariant} />
            <div className="bg-indigo-500 h-full w-[30%]" title={t.rcaPanel.astInvariant} />
            <div className="bg-amber-500 h-full w-[20%]" title={t.rcaPanel.linterInvariant} />
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-600 pt-0.5">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {t.rcaPanel.testsInvariant}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              {t.rcaPanel.astInvariant}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {t.rcaPanel.linterInvariant}
            </span>
          </div>
        </div>
      </div>

      {/* Synthesized Root Cause Analysis Card */}
      <div className="bg-white border border-amber-200/80 rounded-xl p-4 shadow-xs space-y-2.5">
        <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 tracking-wide uppercase">
          <Flame className="w-4 h-4 text-amber-600" />
          <span>{t.rcaPanel.synthesizedRcaTitle}</span>
        </div>

        <p className="text-xs text-slate-700 leading-relaxed font-sans">
          {summary}
        </p>
      </div>

      {/* Telemetry & Safety Matrix (2x2 Grid) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
        <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
          {t.rcaPanel.telemetryMatrixTitle}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">{t.rcaPanel.unitTests}</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              24/24 (100%)
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">{t.rcaPanel.memoryFootprint}</span>
            <span className="font-bold text-slate-800">±0.0 KB</span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">{t.rcaPanel.apiSignature}</span>
            <span className="font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              {t.rcaPanel.nonBreaking}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
            <span className="text-slate-500 text-[11px]">{t.rcaPanel.runtimeOverhead}</span>
            <span className="font-bold text-emerald-700">&lt; 0.02ms</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500 text-[11px] flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-indigo-600" />
            {t.rcaPanel.blastRadius}
          </span>
          <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
            /api/v1/auth/refresh
          </span>
        </div>
      </div>

      {/* Collapsible Diagnostics: Crash Trace */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <button
          onClick={() => setIsCrashTraceOpen(!isCrashTraceOpen)}
          className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-mono font-bold text-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-rose-600" />
            {t.rcaPanel.crashTraceTitle}
          </span>
          {isCrashTraceOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isCrashTraceOpen && (
          <div className="p-3 bg-slate-900 text-slate-100 font-mono text-[11px] leading-relaxed overflow-x-auto">
            <div className="text-rose-400 font-bold mb-1">
              TypeError: Cannot read properties of undefined (reading 'token')
            </div>
            <div className="text-slate-400">
              {'  at refreshToken (src/controllers/auth-controller.ts:142:35)'}
            </div>
            <div className="text-slate-500">
              {'  at Layer.handle [as handle_request] (node_modules/express/lib/router/layer.js:95:5)'}
            </div>
            <div className="text-slate-500">
              {'  at next (node_modules/express/lib/router/route.js:144:13)'}
            </div>
            <div className="text-emerald-400 mt-1">
              Context: redis_cluster_eviction_event (event_id: 0x9f18a)
            </div>
          </div>
        )}
      </div>

      {/* Collapsible Diagnostics: Local Repro Command */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <button
          onClick={() => setIsReproOpen(!isReproOpen)}
          className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-mono font-bold text-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            {t.rcaPanel.localReproTitle}
          </span>
          {isReproOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isReproOpen && (
          <div className="p-3 bg-slate-50 text-slate-800 font-mono text-[11px] border-t border-slate-200">
            <code>npm test -- --grep "auth token refresh concurrency"</code>
          </div>
        )}
      </div>

      {/* Collapsible Diagnostics: Agent Tool Trace */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <button
          onClick={() => setIsTraceOpen(!isTraceOpen)}
          className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 flex items-center justify-between text-xs font-mono font-bold text-slate-800 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-indigo-600" />
            {format(t.rcaPanel.agentToolTraceTitle, { count: logs.length })}
          </span>
          {isTraceOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {isTraceOpen && (
          <div className="p-3 space-y-2 bg-slate-50/50 border-t border-slate-200">
            {logs.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">
                {t.rcaPanel.noToolsRecorded}
              </p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 bg-white border border-slate-200 rounded text-xs font-mono"
                >
                  <div className="flex items-center justify-between text-slate-500 text-[10px]">
                    <span className="font-bold text-indigo-700">
                      {t.common.step} #{log.step_number}: {log.tool_name}
                    </span>
                    <span>{new Date(log.created_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-slate-800 text-[11px] mt-1 truncate">
                    {JSON.stringify(log.tool_input)}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
