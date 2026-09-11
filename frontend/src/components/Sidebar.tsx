import React from "react";
import {
  LayoutDashboard,
  Activity,
  GitPullRequest,
  ShieldCheck,
  Cpu,
  Sparkles,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface SidebarProps {
  currentTab: "dashboard" | "logs" | "prs";
  onTabChange: (tab: "dashboard" | "logs" | "prs") => void;
  isBackendConnected: boolean;
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
}

export interface ModelOption {
  id: string;
  name: string;
  quotaTag: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  { id: 'google/gemma-4-26b-a4b-it:free', name: 'Gemma 26B (OpenRouter)', quotaTag: 'Free' },
  { id: 'nvidia/nemotron-3.5-lightning:free', name: 'Nemotron 3.5 (OpenRouter)', quotaTag: 'Free' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', quotaTag: '1500 RPD' },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', quotaTag: '1500 RPD' },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', quotaTag: '50 RPD' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isBackendConnected,
  selectedModel = "gemini-2.0-flash",
  onModelChange,
}) => {
  const { t } = useLanguage();

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col justify-between shrink-0 h-screen sticky top-0">
      {/* Top Section: Logo & Navigation */}
      <div>
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Sparkles className="w-5 h-5 text-indigo-100" />
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 tracking-tight flex items-center gap-1.5">
              {t.header.brandName}
            </div>
            <div className="text-[11px] font-mono text-slate-500 font-medium">
              {t.sidebar.engineSubtitle}
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          <button
            onClick={() => onTabChange("dashboard")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === "dashboard"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 text-indigo-600" />
            {t.sidebar.commandBoard}
          </button>

          <button
            onClick={() => onTabChange("logs")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === "logs"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Activity className="w-4 h-4 text-slate-500" />
            {t.sidebar.auditLogs}
          </button>

          <button
            onClick={() => onTabChange("prs")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              currentTab === "prs"
                ? "bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-xs"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <GitPullRequest className="w-4 h-4 text-slate-500" />
            {t.sidebar.prHistory}
          </button>
        </nav>
      </div>

      {/* Bottom Section: Runtime Diagnostics Footer */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              {t.sidebar.runtime}
            </span>
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                isBackendConnected
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendConnected ? "bg-emerald-500" : "bg-rose-500"
                }`}
              />
              {isBackendConnected ? t.common.online : t.common.offline}
            </span>
          </div>

          <div className="text-[11px] font-medium text-slate-700 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={selectedModel}
              onChange={(e) => onModelChange(e.target.value)}
              className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer text-xs"
              title="Pilih Model AI Gemini"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="text-slate-900">
                  {m.name} ({m.quotaTag})
                </option>
              ))}
            </select>
          </div>

          <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono pt-1 border-t border-slate-100">
            <ShieldCheck className="w-3 h-3 text-indigo-600" />
            <span>{t.sidebar.guardedAutonomy}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
