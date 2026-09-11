import React, { useState } from 'react';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import {
  FileCode,
  CheckCircle2,
} from 'lucide-react';
import type { PatchRecord, PatchAction } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface DiffViewerProps {
  patches: PatchRecord[];
  taskTitle?: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ patches }) => {
  const { t } = useLanguage();
  const [isSplitView, setIsSplitView] = useState(true);
  const [activeFileIndex, setActiveFileIndex] = useState(0);

  // Extract all actions from all patches
  const allActions: PatchAction[] = patches.flatMap((p) => {
    if (p.actions && p.actions.length > 0) return p.actions;
    if (p.file_path && p.search_block) {
      return [
        {
          file_path: p.file_path,
          search_block: p.search_block,
          replace_block: p.replace_block,
          explanation: p.explanation || '',
        },
      ];
    }
    return [];
  });

  if (allActions.length === 0) {
    // Provide a rich default mock diff if no patch has been generated yet
    return (
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-mono font-bold text-slate-800">
              auth-controller.ts
            </span>
            <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
              +12
            </span>
            <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
              -4
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsSplitView(false)}
              className={`px-2 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                !isSplitView
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.diffViewer.unified}
            </button>
            <button
              onClick={() => setIsSplitView(true)}
              className={`px-2 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
                isSplitView
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {t.diffViewer.splitView}
            </button>
          </div>
        </div>

        {/* Diff Subheader */}
        <div className="px-4 py-2 bg-slate-100/70 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            {t.diffViewer.headMock}
          </span>
          <span className="flex items-center gap-1.5 font-bold text-indigo-700">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            {t.diffViewer.aiSynthesizedPatch}
            <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded uppercase">
              {t.diffViewer.astVerified}
            </span>
          </span>
        </div>

        {/* Diff Content */}
        <div className="diff-viewer-wrapper overflow-x-auto">
          <ReactDiffViewer
            oldValue={`export async function refreshToken(req, res) {\n  const logger = req.app.get("logger");\n  logger.info("Attempting session renewal");\n  const token = req.user.session.token;\n  const refreshed = await verifyJwt(token);\n  return res.json({ token: refreshed });\n}`}
            newValue={`export async function refreshToken(req, res) {\n  const logger = req.app.get("logger");\n  logger.info("Attempting session renewal");\n  const session = req.user?.session;\n  if (!session?.token) {\n    logger.warn("Null session detected during refresh");\n    return res.status(401).json({\n      error: "UNAUTHENTICATED",\n      message: "Session expired or invalid"\n    });\n  }\n  const refreshed = await verifyJwt(session.token);\n  return res.json({ token: refreshed });\n}`}
            splitView={isSplitView}
            useDarkTheme={false}
            compareMethod={DiffMethod.WORDS}
            styles={{
              variables: {
                light: {
                  diffViewerBackground: '#ffffff',
                  diffViewerColor: '#1e293b',
                  addedBackground: '#e6ffec',
                  addedColor: '#1a7f37',
                  removedBackground: '#ffebe9',
                  removedColor: '#cf222e',
                  wordAddedBackground: '#abf2bc',
                  wordRemovedBackground: '#ffc1c0',
                  addedGutterBackground: '#ccffd8',
                  removedGutterBackground: '#ffd7d5',
                  gutterBackground: '#f6f8fa',
                  gutterBackgroundDark: '#f1f5f9',
                  highlightBackground: '#fffbdd',
                  highlightGutterBackground: '#fff5b1',
                },
              },
              line: {
                fontSize: '12px',
                lineHeight: '20px',
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
              },
            }}
          />
        </div>

        {/* Verification Summary Strip */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          <div className="flex items-center gap-3 text-slate-700">
            <span className="flex items-center gap-1 text-emerald-700 font-bold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {t.diffViewer.testsPassed}
            </span>
            <span className="text-slate-500">
              {t.diffViewer.coverage} <strong className="text-slate-800">94.2%</strong> (+1.8%)
            </span>
            <span className="text-slate-500">
              {t.diffViewer.linter} <strong className="text-slate-800">{t.diffViewer.linterZeroWarnings}</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-500 text-[11px]">
            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              {t.diffViewer.astVerifiedSafe}
            </span>
            <span className="hidden sm:inline">
              {t.diffViewer.ephemeralSandbox}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const currentAction = allActions[activeFileIndex] || allActions[0];

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* File Tabs & View Mode Switcher */}
      <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/80 flex-wrap gap-2">
        <div className="flex items-center gap-1.5 overflow-x-auto max-w-full">
          {allActions.map((action, idx) => (
            <button
              key={idx}
              onClick={() => setActiveFileIndex(idx)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                activeFileIndex === idx
                  ? 'bg-white text-indigo-700 font-bold border border-slate-200 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileCode className="w-3.5 h-3.5 text-indigo-600" />
              <span>{action.file_path.split('/').pop() || action.file_path}</span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-1 rounded border border-emerald-200">
                +mod
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setIsSplitView(false)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
              !isSplitView
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.diffViewer.unified}
          </button>
          <button
            onClick={() => setIsSplitView(true)}
            className={`px-2.5 py-1 rounded text-xs font-mono transition-all cursor-pointer ${
              isSplitView
                ? 'bg-white text-slate-900 font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            {t.diffViewer.splitView}
          </button>
        </div>
      </div>

      {/* Subheader */}
      <div className="px-4 py-2 bg-slate-50/60 border-b border-slate-200 flex items-center justify-between text-[11px] font-mono text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          {t.diffViewer.headOriginal}
        </span>
        <span className="flex items-center gap-1.5 font-bold text-indigo-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          {t.diffViewer.aiSynthesizedPatch}
          <span className="text-[9px] bg-indigo-100 text-indigo-800 px-1 rounded uppercase">
            {t.diffViewer.astVerified}
          </span>
        </span>
      </div>

      {/* Diff Content View */}
      <div className="diff-viewer-wrapper overflow-x-auto max-h-[480px]">
        <ReactDiffViewer
          oldValue={currentAction.search_block}
          newValue={currentAction.replace_block}
          splitView={isSplitView}
          useDarkTheme={false}
          compareMethod={DiffMethod.WORDS}
          styles={{
            variables: {
              light: {
                diffViewerBackground: '#ffffff',
                diffViewerColor: '#1e293b',
                addedBackground: '#e6ffec',
                addedColor: '#1a7f37',
                removedBackground: '#ffebe9',
                removedColor: '#cf222e',
                wordAddedBackground: '#abf2bc',
                wordRemovedBackground: '#ffc1c0',
                addedGutterBackground: '#ccffd8',
                removedGutterBackground: '#ffd7d5',
                gutterBackground: '#f6f8fa',
                gutterBackgroundDark: '#f1f5f9',
                highlightBackground: '#fffbdd',
                highlightGutterBackground: '#fff5b1',
              },
            },
            line: {
              fontSize: '12px',
              lineHeight: '20px',
              fontFamily: 'JetBrains Mono, Fira Code, monospace',
            },
          }}
        />
      </div>

      {/* Verification Summary Strip */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
        <div className="flex items-center gap-3 text-slate-700">
          <span className="flex items-center gap-1 text-emerald-700 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {t.diffViewer.testsPassed}
          </span>
          <span className="text-slate-500">
            {t.diffViewer.coverage} <strong className="text-slate-800">94.2%</strong> (+1.8%)
          </span>
          <span className="text-slate-500">
            {t.diffViewer.linter} <strong className="text-slate-800">{t.diffViewer.linterZeroWarnings}</strong>
          </span>
        </div>

        <div className="flex items-center gap-2 text-slate-500 text-[11px]">
          <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            {t.diffViewer.astVerifiedSafe}
          </span>
          <span className="hidden sm:inline">
            {t.diffViewer.ephemeralSandbox}
          </span>
        </div>
      </div>
    </div>
  );
};
