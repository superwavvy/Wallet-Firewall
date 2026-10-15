'use client';

import { useState, useEffect } from 'react';
import { RiskReport } from '@/lib/risk-engine';

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
    SAFE: { border: 'border-green-500', bg: 'bg-green-950/20', text: 'text-green-400', label: 'SAFE' },
    REVIEW: { border: 'border-yellow-500', bg: 'bg-yellow-950/20', text: 'text-yellow-400', label: 'REVIEW' },
    BLOCK: { border: 'border-red-500', bg: 'bg-red-950/20', text: 'text-red-500', label: 'BLOCK' },
  };

  const currentStyle = styles[report.verdict];

  return (
    <div className={`mt-6 border-2 ${currentStyle.border} ${currentStyle.bg} p-6 font-mono text-sm relative overflow-hidden`}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h3 className="text-gray-400 uppercase tracking-wider text-xs mb-1">Security Verdict</h3>
          <div className={`text-4xl font-black ${currentStyle.text} tracking-tighter`}>{currentStyle.label}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-500 text-xs mb-1">RISK SCORE</div>
          <div className={`text-3xl font-bold ${currentStyle.text}`}>{report.score}<span className="text-lg text-gray-600">/100</span></div>
        </div>
      </div>

      {/* AI Explanation Section */}
      <div className="mb-6 p-4 bg-black/40 border border-gray-800 rounded">
        <h4 className="text-gray-400 uppercase tracking-wider text-[10px] mb-2 flex items-center gap-2">
          <span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span> AI Explainer {aiProvider && <span className="text-cyan-600 ml-1">[{aiProvider}]</span>}
        </h4>
        <p className="text-gray-300 text-xs leading-relaxed">
          {aiLoading ? 'Generating explanation...' : aiExplanation}
        </p>
      </div>

      <div className="space-y-4 border-t border-gray-800 pt-4">
        <h4 className="text-gray-400 uppercase tracking-wider text-xs mb-2">Deterministic Findings ({report.signals.length})</h4>
        {report.signals.length === 0 ? (
          <p className="text-gray-500 text-xs">No risk signals detected.</p>
        ) : (
          report.signals.map((signal, index) => (
            <div key={index} className="border-l-4 pl-4 border-gray-700">
              <div className="flex gap-2 mb-1 items-center">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  signal.severity === 'CRITICAL' ? 'bg-red-900 text-red-300' :
                  signal.severity === 'HIGH' ? 'bg-orange-900 text-orange-300' :
                  signal.severity === 'MEDIUM' ? 'bg-yellow-900 text-yellow-300' :
                  'bg-gray-800 text-gray-300'
                }`}>{signal.severity}</span>
                <span className="text-xs text-white font-bold">{signal.explanation}</span>
              </div>
              <div className="text-xs text-gray-500 mb-1">Evidence: {signal.evidence}</div>
              <div className={`text-xs font-bold ${signal.isHardBlock ? 'text-red-400' : 'text-gray-400'}`}>Action: {signal.recommendation}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
