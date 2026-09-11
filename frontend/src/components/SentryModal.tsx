import React, { useState } from 'react';
import { Zap, Copy, Check, Terminal } from 'lucide-react';

interface SentryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestTriggered?: () => void;
}

export const SentryModal: React.FC<SentryModalProps> = ({
  isOpen,
  onClose,
  onTestTriggered,
}) => {
  const [copied, setCopied] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationResult, setSimulationResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const webhookUrl = `${window.location.protocol}//${window.location.hostname}:8000/api/v1/webhooks/sentry`;

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSimulateAlert = async () => {
    setIsSimulating(true);
    setSimulationResult(null);

    const testPayload = {
      event: {
        title: "TypeError: Cannot read properties of undefined (reading 'avatar')",
        culprit: "src/components/UserProfileCard.tsx:42",
        location: "src/components/UserProfileCard.tsx:42",
      },
      project_slug: "NamiraAulia/Virtual-dev-team",
    };

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      const data = await res.json();
      if (res.ok) {
        setSimulationResult(`✅ Sentry Alert Simulated! Task created: ${data.task_id || 'OK'}`);
        if (onTestTriggered) onTestTriggered();
      } else {
        setSimulationResult(`❌ Simulation Failed: ${data.detail || 'Error'}`);
      }
    } catch (err) {
      setSimulationResult(`❌ Backend offline or unreachable at ${webhookUrl}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <Zap className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sentry Webhook Integration</h3>
              <p className="text-[11px] font-mono text-slate-500">Connect production error logs to AI Dev Team</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg hover:bg-slate-100"
          >
            ✕
          </button>
        </div>

        {/* Webhook URL Field */}
        <div className="space-y-1.5">
          <label className="text-xs font-mono font-bold text-slate-700 block">
            Target Webhook Endpoint URL:
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={webhookUrl}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-800 select-all"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-xl text-xs font-bold font-mono transition-colors border border-indigo-200"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Step-by-step Guide */}
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs font-mono text-slate-700">
          <div className="font-bold text-slate-900 flex items-center gap-1.5">
            <span>Panduan Cara Menyambungkan di Sentry.io:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600">
            <li>Buka dashboard <b>Sentry.io</b> &gt; Settings &gt; Integrations.</li>
            <li>Pilih <b>Webhooks</b> &gt; Add Integration.</li>
            <li>Tempelkan <b>Webhook URL</b> di atas.</li>
            <li>Set Rule: <i>"Send Webhook when a new issue is created"</i>.</li>
          </ol>
        </div>

        {/* Test Alert Simulator Button */}
        <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
          <button
            onClick={handleSimulateAlert}
            disabled={isSimulating}
            className="w-full flex items-center justify-center gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-mono font-bold text-xs py-2.5 rounded-xl transition-all shadow-xs disabled:opacity-50"
          >
            <Terminal className="w-4 h-4" />
            <span>{isSimulating ? 'Simulating Alert...' : '⚡ Simulate Incoming Sentry Alert (Test)'}</span>
          </button>

          {simulationResult && (
            <div className="p-2.5 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] text-center border border-slate-800">
              {simulationResult}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
