'use client';

import { useState, useEffect } from 'react';
import { RiskReport, RiskSignal } from '@/lib/risk-engine';

const SEVERITY_RANK: Record<RiskSignal['severity'], number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const SEVERITY_BADGE: Record<RiskSignal['severity'], string> = {
  CRITICAL: 'bg-red-900 text-red-300',
  HIGH: 'bg-orange-900 text-orange-300',
  MEDIUM: 'bg-yellow-900 text-yellow-300',
  LOW: 'bg-gray-800 text-gray-300',
};

// Hard blocks first, then by severity, then by score impact
function sortSignals(signals: RiskSignal[]): RiskSignal[] {
  return [...signals].sort((a, b) => {
    if (a.isHardBlock !== b.isHardBlock) return a.isHardBlock ? -1 : 1;
    if (SEVERITY_RANK[a.severity] !== SEVERITY_RANK[b.severity]) {
      return SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    }
    return b.scoreContribution - a.scoreContribution;
  });
}

export function RiskReportCard({ report }: { report: RiskReport }) {
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiProvider, setAiProvider] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    async function fetchExplanation() {
      if (!report) return;
      setAiLoading(true);
      try {
        const res = await fetch('/api/explain', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ riskReport: report }),
        });
        const data = await res.json();
        if (data.explanation) { setAiExplanation(data.explanation); setAiProvider(data.provider || null); }
        else setAiExplanation("AI explanation unavailable.");
      } catch (e) {
        setAiExplanation("AI explanation unavailable.");
      }
      setAiLoading(false);
    }
    fetchExplanation();
  }, [report]);

  if (!report) return null;

  const styles = {
    SAFE: { border: 'border-green-500', bg: 'bg-green-950/20', text: 'text-green-400', bar: 'bg-green-950', label: 'SAFE' },
    REVIEW: { border: 'border-yellow-500', bg: 'bg-yellow-950/20', text: 'text-yellow-400', bar: 'bg-yellow-950', label: 'REVIEW' },
    BLOCK: { border: 'border-red-500', bg: 'bg-red-950/20', text: 'text-red-500', bar: 'bg-red-950', label: 'BLOCK' },
  };

  const currentStyle = styles[report.verdict];
  const signals = sortSignals(report.signals);

  return (
    <div className={`mt-6 border-2 ${currentStyle.border} ${currentStyle.bg} font-mono text-sm`}>
      {/* Sticky verdict bar: stays visible while you scroll through the findings */}
      <div className={`sticky top-0 z-10 flex justify-between items-center px-4 py-3 border-b ${currentStyle.border} ${currentStyle.bar}`}>
        <div className={`text-2xl font-black ${currentStyle.text} tracking-tighter`}>{currentStyle.label}</div>
        <div className={`text-xl font-bold ${currentStyle.text}`}>
          {report.score}<span className="text-sm text-gray-500">/100</span>
        </div>
      </div>

      <div className="p-4">
        {/* Deterministic findings come first: they decide the verdict */}
        <h4 className="text-gray-400 uppercase tracking-wider text-xs mb-3">
          Deterministic Findings ({signals.length})
        </h4>

        {signals.length === 0 ? (
          <p className="text-gray-500 text-xs">No risk signals detected.</p>
        ) : (
          <div className="space-y-2">
            {signals.map((signal, index) => (
              <details
                key={index}
                open={signal.isHardBlock || signal.severity === 'CRITICAL' || signal.severity === 'HIGH'}
                className="border-l-4 border-gray-700 pl-3 py-1 bg-black/30"
              >
                <summary className="cursor-pointer list-none flex gap-2 items-start">
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded ${SEVERITY_BADGE[signal.severity]}`}>
                    {signal.severity}
                  </span>
                  <span className="text-xs text-white font-bold break-words min-w-0">{signal.explanation}</span>
                </summary>
                <div className="mt-2 text-xs text-gray-500 break-all">Evidence: {signal.evidence}</div>
                <div className={`mt-1 text-xs font-bold break-words ${signal.isHardBlock ? 'text-red-400' : 'text-gray-400'}`}>
                  Action: {signal.recommendation}
                </div>
              </details>
            ))}
          </div>
        )}

        {/* AI explanation second, collapsed: it explains, it never decides */}
        <details className="mt-4 bg-black/40 border border-gray-800 rounded p-3">
          <summary className="cursor-pointer list-none text-gray-400 uppercase tracking-wider text-[10px] flex items-center gap-2">
            <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>
            AI Explainer {aiProvider && <span className="text-cyan-600">[{aiProvider}]</span>}
            {aiLoading && <span className="text-gray-600">(loading...)</span>}
          </summary>
          <p className="mt-2 text-gray-300 text-xs leading-relaxed">
            {aiLoading ? 'Generating explanation...' : aiExplanation}
          </p>
        </details>
      </div>
    </div>
  );
}
