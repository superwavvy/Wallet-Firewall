'use client';

import { useEffect, useState } from 'react';

// Shows console errors on screen when the URL has ?debug (handy on mobile, no devtools needed)
export function DebugPanel() {
  const [lines, setLines] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    setEnabled(true);

    const show = (a: unknown) => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    };
    const add = (kind: string, args: unknown[]) => {
      const text = args.map(show).join(' ').slice(0, 300);
      setLines((prev) => [...prev.slice(-19), `[${kind}] ${text}`]);
    };

    const origError = console.error;
    const origWarn = console.warn;
    console.error = (...args: unknown[]) => { add('error', args); origError(...args); };
    console.warn = (...args: unknown[]) => { add('warn', args); origWarn(...args); };
    const onError = (e: ErrorEvent) => add('window', [e.message]);
    const onRejection = (e: PromiseRejectionEvent) => add('promise', [e.reason?.message ?? String(e.reason)]);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      console.error = origError;
      console.warn = origWarn;
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 max-h-48 overflow-y-auto bg-black/95 border-t border-red-800 p-2 text-[10px] font-mono text-red-300 break-all">
      <div className="text-gray-500 mb-1">DEBUG LOG (last 20)</div>
      {lines.length === 0 ? <div className="text-gray-600">No errors yet.</div> : lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}
