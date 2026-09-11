import React from 'react';
import {
  Terminal,
  FolderTree,
  FileCode,
  Search,
  Loader2,
} from 'lucide-react';
import type { TaskLogEntry } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface LiveActivityFeedProps {
  logs: TaskLogEntry[];
  isExploring: boolean;
  isLoading: boolean;
}

const toolIcons: Record<string, React.ReactNode> = {
  list_directory: <FolderTree className="w-3.5 h-3.5 text-indigo-600" />,
  read_file: <FileCode className="w-3.5 h-3.5 text-emerald-600" />,
  search_code: <Search className="w-3.5 h-3.5 text-amber-600" />,
};

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({
  logs,
  isExploring,
  isLoading,
}) => {
  const { t, format } = useLanguage();

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
            {format(t.activityFeed.header, { count: logs.length })}
          </h2>
        </div>
        {isExploring && (
          <div className="flex items-center gap-1.5 text-indigo-700 text-xs font-mono font-semibold bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{t.activityFeed.agentActiveBadge}</span>
          </div>
        )}
      </div>

      {/* Log Feed Body */}
      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {isLoading && logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            {t.activityFeed.loading}
          </div>
        ) : logs.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 font-mono">
            {isExploring
              ? t.activityFeed.initializing
              : t.activityFeed.empty}
          </div>
        ) : (
          logs.map((log) => {
            const icon = toolIcons[log.tool_name] || (
              <Terminal className="w-3.5 h-3.5 text-slate-500" />
            );

            return (
              <div
                key={log.id}
                className="bg-slate-50/80 border border-slate-200 rounded-xl p-3 space-y-2 text-xs font-mono shadow-2xs"
              >
                {/* Step Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white border border-slate-200 flex items-center justify-center shadow-xs">
                      {icon}
                    </div>
                    <span className="font-bold text-slate-900">
                      {t.common.step} #{log.step_number}:
                    </span>
                    <span className="font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[11px]">
                      {log.tool_name}
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-400">
                    {new Date(log.created_at).toLocaleTimeString()}
                  </span>
                </div>

                {/* Input Arguments */}
                <div className="bg-white p-2 rounded-lg border border-slate-200 text-slate-700 text-[11px] overflow-x-auto">
                  <span className="text-slate-400 select-none">{t.activityFeed.argsLabel} </span>
                  <code>{JSON.stringify(log.tool_input)}</code>
                </div>

                {/* Output Snippet */}
                {log.tool_output && (
                  <div className="bg-slate-900 text-slate-100 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed overflow-x-auto max-h-32">
                    <pre className="whitespace-pre-wrap">{log.tool_output}</pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
