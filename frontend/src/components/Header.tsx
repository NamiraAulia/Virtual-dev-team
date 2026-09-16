import React from 'react';
import {
  Plus,
  FolderGit2,
  Languages,
} from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  onNewTaskClick: () => void;
  onSentryClick?: () => void;
  isBackendConnected: boolean;
  activeRepo?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onNewTaskClick,
  onSentryClick,
  isBackendConnected,
  activeRepo = 'payment-gateway',
}) => {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between sticky top-0 z-20 shadow-xs">
      {/* Left: Active Repo & Backend Status */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700">
          <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
          <span className="font-semibold text-slate-900">{t.header.repoLabel}</span>
          <span>{activeRepo}</span>
          <span className="text-slate-400 font-sans">(main)</span>
        </div>

        {/* Backend Online Status Pill */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              isBackendConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
          <span className="font-semibold">
            {isBackendConnected ? t.common.fastApiOnline : t.common.fastApiOffline}
          </span>
          <span className="text-emerald-600 text-[11px]">(24ms)</span>
        </div>
      </div>

      {/* Right: Sentry Webhook, Language Switcher, & New Task Button */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {onSentryClick && (
          <button
            onClick={onSentryClick}
            className="flex items-center gap-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all shadow-xs cursor-pointer"
            title="Connect Sentry Webhook"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
            <span>⚡ Sentry Webhook</span>
          </button>
        )}

        {/* Language Switcher Pill */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs font-mono">
          <Languages className="w-3.5 h-3.5 text-slate-500 ml-1 mr-1.5" />
          <button
            onClick={() => setLanguage('id')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
              language === 'id'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="Bahasa Indonesia"
          >
            ID
          </button>
          <button
            onClick={() => setLanguage('en')}
            className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-white text-indigo-700 shadow-xs border border-slate-200/80'
                : 'text-slate-500 hover:text-slate-900'
            }`}
            title="English"
          >
            EN
          </button>
        </div>

        <button
          onClick={onNewTaskClick}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs hover:shadow-indigo-200/50 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.header.newTaskButton}</span>
          <kbd className="hidden sm:inline-block bg-indigo-700/60 border border-indigo-400/30 text-indigo-100 px-1.5 py-0.2 rounded text-[10px] font-mono font-normal">
            {t.header.ctrlShortcut}
          </kbd>
        </button>
      </div>
    </header>
  );
};
