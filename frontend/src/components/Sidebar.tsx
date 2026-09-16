import React from "react";
import {
  LayoutDashboard,
  Activity,
  GitPullRequest,
  ShieldCheck,
  Cpu,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface SidebarProps {
  currentTab: "dashboard" | "logs" | "prs";
  onTabChange: (tab: "dashboard" | "logs" | "prs") => void;
  isBackendConnected: boolean;
  selectedModel?: string;
  onModelChange: (modelId: string) => void;
}

import { AVAILABLE_MODELS } from "../constants/models";

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isBackendConnected,
  selectedModel = "gemini-flash-latest",
  onModelChange,
}) => {
  const { t } = useLanguage();

  const navItems = [
    {
      id: "dashboard" as const,
      label: t.sidebar.commandBoard,
      icon: LayoutDashboard,
    },
    {
      id: "logs" as const,
      label: t.sidebar.auditLogs,
      icon: Activity,
    },
    {
      id: "prs" as const,
      label: t.sidebar.prHistory,
      icon: GitPullRequest,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 h-screen sticky top-0 text-slate-200">
      {/* Brand & Navigation */}
      <div>
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-md shadow-indigo-900/40">
            <Sparkles className="w-4.5 h-4.5 text-indigo-100" />
          </div>
          <div>
            <div className="font-bold text-sm text-white tracking-tight flex items-center gap-1.5">
              {t.header.brandName}
            </div>
            <div className="text-[11px] font-mono text-slate-400 font-medium">
              {t.sidebar.engineSubtitle}
            </div>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="p-3 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 cursor-pointer ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 shadow-sm"
                    : "text-slate-400 hover:bg-slate-800/70 hover:text-slate-200"
                }`}
              >
                <Icon
                  className={`w-4 h-4 transition-colors ${
                    isActive ? "text-indigo-400" : "text-slate-500"
                  }`}
                />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Runtime Status & Model Selector */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-3 rounded-xl border border-slate-800 bg-slate-900/80 space-y-2.5">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-slate-400">
              {t.sidebar.runtime}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border ${
                isBackendConnected
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-400 border-rose-500/30"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isBackendConnected
                    ? "bg-emerald-400 animate-pulse"
                    : "bg-rose-400"
                }`}
              />
              {isBackendConnected ? t.common.online : t.common.offline}
            </span>
          </div>

          {/* AI Model Dropdown */}
          <div className="space-y-1">
            <div className="text-[10px] font-mono text-slate-400 flex items-center gap-1.5">
              <Cpu className="w-3 h-3 text-indigo-400 shrink-0" />
              <span>AI Engine</span>
            </div>
            <div className="relative">
              <select
                value={selectedModel}
                onChange={(e) => onModelChange(e.target.value)}
                className="w-full bg-slate-800/90 text-slate-200 font-medium text-xs px-2.5 py-1.5 pr-7 rounded-lg border border-slate-700/80 focus:outline-none focus:border-indigo-500 appearance-none cursor-pointer"
                title="Select AI Model"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-slate-200">
                    {m.name} ({m.quotaTag})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2.5 pointer-events-none" />
            </div>
          </div>

          {/* Autonomy Badge */}
          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono pt-1.5 border-t border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.sidebar.guardedAutonomy}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};

