import React from 'react';
import { CheckCircle, RotateCw, FileCode } from 'lucide-react';
import type { TaskLogEntry } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface LiveTurnBannerProps {
  status: string | undefined;
  logs: TaskLogEntry[];
  isExploring: boolean;
}

export const LiveTurnBanner: React.FC<LiveTurnBannerProps> = ({
  status,
  logs,
  isExploring,
}) => {
  const { t, format } = useLanguage();
  const currentStep = logs.length > 0 ? logs.length : 1;
  const maxSteps = 5;
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

  // Derive counts
  const fileCount = logs.filter((l) => l.tool_name === 'read_file').length || (isExploring ? 1 : 4);
  const searchCount = logs.filter((l) => l.tool_name === 'search_code' || l.tool_name === 'list_directory').length || (isExploring ? 1 : 2);

  // Format running command description
  let runningDesc = t.telemetryBanner.initializedDesc;
  if (isExploring) {
    if (lastLog) {
      const argsStr = JSON.stringify(lastLog.tool_input).replace(/[{}"]/g, '');
      runningDesc = `${lastLog.tool_name}(${argsStr})`;
    } else {
      runningDesc = t.telemetryBanner.exploringTreeDesc;
    }
  } else if (status === 'patch_ready' || status === 'approved' || status === 'pr_created') {
    runningDesc = t.telemetryBanner.synthesizedDesc;
  } else if (status === 'failed' || status === 'rejected') {
    runningDesc = t.telemetryBanner.haltedDesc;
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
      {/* Left: Turn Badge & Running Tool Status */}
      <div className="flex items-start md:items-center gap-3 min-w-0 flex-1">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-mono font-bold shrink-0">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          {t.common.turn} {Math.min(currentStep, maxSteps)} / {maxSteps}
        </div>

        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isExploring ? (
            <RotateCw className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
          ) : (
            <FileCode className="w-4 h-4 text-slate-400 shrink-0" />
          )}

          <div className="text-xs font-mono bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-slate-800 truncate w-full flex items-center gap-2">
            <span className="text-slate-400 font-semibold select-none">
              {isExploring ? t.telemetryBanner.runningPrefix : t.telemetryBanner.statusPrefix}
            </span>
            <span className="text-slate-900 font-medium truncate">
              {runningDesc}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Quick Telemetry Invariants & Elapsed Bar */}
      <div className="flex items-center gap-3 text-xs font-mono shrink-0 justify-end border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
        <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
          <span>{format(t.telemetryBanner.readFiles, { count: fileCount })}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>{format(t.telemetryBanner.astInvariants, { count: searchCount })}</span>
        </div>

        <div className="flex items-center gap-1.5 text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>{t.telemetryBanner.regressions}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 pl-2 border-l border-slate-200">
          <span className="text-slate-500 text-[11px]">{t.common.elapsed}</span>
          <span className="font-bold text-slate-800">
            {isExploring ? '...' : '4.2s'}
          </span>
          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div
              className={`h-full ${
                isExploring
                  ? 'bg-indigo-600 animate-pulse w-3/4'
                  : 'bg-emerald-500 w-full'
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
