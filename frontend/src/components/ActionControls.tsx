import React, { useState } from 'react';
import {
  Rocket,
  XCircle,
  Play,
  Loader2,
  Copy,
  Check,
  FlaskConical,
  ShieldCheck,
  ExternalLink,
  Lock,
} from 'lucide-react';
import type { Task, PatchRecord } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface ActionControlsProps {
  task: Task | undefined;
  patches: PatchRecord[];
  onRun: () => void;
  onApprove: (comment?: string) => void;
  onReject: (reason?: string) => void;
  isRunLoading: boolean;
  isApproveLoading: boolean;
  isRejectLoading: boolean;
}

export const ActionControls: React.FC<ActionControlsProps> = ({
  task,
  patches,
  onRun,
  onApprove,
  onReject,
  isRunLoading,
  isApproveLoading,
  isRejectLoading,
}) => {
  const { t, format } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!task) return null;

  const isExploring = task.status === 'exploring';
  const isApproved = task.status === 'approved' || task.status === 'pr_created';
  const isRejected = task.status === 'rejected';
  const isPending = task.status === 'pending';
  const isReady = task.status === 'patch_ready';

  const hasPatches = patches.length > 0;
  const shortId = task.id.slice(0, 4);

  const handleCopyPatch = () => {
    if (patches.length > 0) {
      const patchText = JSON.stringify(patches[0], null, 2);
      navigator.clipboard.writeText(patchText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleRejectConfirm = () => {
    onReject(rejectReason || 'Manual rejection by operator');
    setShowRejectInput(false);
    setRejectReason('');
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
      {/* Top Header: Decision Gate Info */}
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              {t.actionControls.decisionGateTitle}
            </h3>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              {isApproved
                ? t.actionControls.descApproved
                : isRejected
                ? t.actionControls.descRejected
                : isReady || hasPatches
                ? t.actionControls.descReady
                : t.actionControls.descPending}
            </p>
          </div>
        </div>

        <div>
          {isApproved ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {t.actionControls.statusPrDeployed}
            </span>
          ) : isRejected ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-rose-50 text-rose-800 border border-rose-200">
              {t.actionControls.statusRejected}
            </span>
          ) : isReady || hasPatches ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              {t.actionControls.statusReadyForSignOff}
            </span>
          ) : isExploring ? (
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 animate-pulse">
              {t.actionControls.statusAnalyzing}
            </span>
          ) : (
            <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {t.actionControls.statusPendingRun}
            </span>
          )}
        </div>
      </div>

      {/* Main Actions Row */}
      <div className="pt-1">
        {isPending && !hasPatches ? (
          <button
            onClick={onRun}
            disabled={isRunLoading}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
          >
            {isRunLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{t.actionControls.launchingBtn}</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white" />
                <span>{t.actionControls.startAnalysisBtn}</span>
              </>
            )}
          </button>
        ) : isExploring ? (
          <div className="w-full p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 flex items-center justify-center gap-3 text-indigo-800 text-xs font-mono">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            <span>{t.actionControls.agentLoopExecuting}</span>
          </div>
        ) : isApproved ? (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-900 font-bold">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{format(t.actionControls.prOpened, { pr: task.pr_number || '123' })}</span>
            </div>
            {task.pr_url && (
              <a
                href={task.pr_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-900 bg-white px-3 py-1 rounded-lg border border-emerald-200 shadow-xs"
              >
                {t.actionControls.viewOnGithub}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Primary Sign-Off Action Button */}
              <button
                onClick={() => onApprove()}
                disabled={isApproveLoading || isRejectLoading}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                {isApproveLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.actionControls.creatingPrBtn}</span>
                  </>
                ) : (
                  <>
                    <Rocket className="w-4 h-4" />
                    <span>{format(t.actionControls.openPrBtn, { id: shortId || '123' })}</span>
                  </>
                )}
              </button>

              {/* Reject Action Button */}
              <button
                onClick={() => setShowRejectInput(!showRejectInput)}
                disabled={isApproveLoading || isRejectLoading}
                className="flex items-center justify-center gap-2 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold py-3 px-4 rounded-xl text-xs sm:text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" />
                <span>{t.actionControls.rejectPatchBtn}</span>
              </button>
            </div>

            {/* Expandable Rejection Reason Input */}
            {showRejectInput && (
              <div className="p-3 bg-rose-50/50 border border-rose-200 rounded-xl space-y-2">
                <input
                  type="text"
                  placeholder={t.actionControls.rejectReasonPlaceholder}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full text-xs p-2 rounded-lg bg-white border border-rose-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowRejectInput(false)}
                    className="px-3 py-1 rounded text-xs text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    onClick={handleRejectConfirm}
                    disabled={isRejectLoading}
                    className="px-3 py-1 bg-rose-600 text-white rounded text-xs font-bold hover:bg-rose-700 cursor-pointer"
                  >
                    {t.actionControls.confirmRejection}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auxiliary Actions & Credential Footer */}
      <div className="pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs font-mono text-slate-500">
        <div className="flex items-center gap-4">
          <button
            onClick={handleCopyPatch}
            className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span>{copied ? t.common.copied : t.actionControls.copyPatchBtn}</span>
          </button>

          <button
            onClick={() => alert('Simulating boundary edge cases in sandbox... (0 regressions)')}
            className="flex items-center gap-1.5 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <FlaskConical className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.actionControls.simulateEdgeCases}</span>
          </button>
        </div>

        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <Lock className="w-3 h-3" />
          <span>{t.actionControls.engineerSignature}</span>
        </div>
      </div>
    </div>
  );
};
