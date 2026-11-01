'use client';

export function SimulationCard({ result }: { result: any }) {
  if (!result) return null;

  // Neutral on success: "runs without reverting" is NOT the same as "safe"
  const state = result.success
    ? { label: 'EXECUTES', box: 'border-gray-700', text: 'text-cyan-400' }
    : result.reverted === false
    ? { label: 'UNAVAILABLE', box: 'border-yellow-800', text: 'text-yellow-400' }
    : { label: 'REVERTS', box: 'border-red-800', text: 'text-red-500' };

  return (
    <div className={`mt-6 border ${state.box} bg-gray-950 p-6 font-mono text-sm`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gray-400 uppercase tracking-wider">Simulation Result</h3>
        <span className={`font-bold ${state.text}`}>{state.label}</span>
      </div>
      <div className="bg-gray-900 p-3 border border-gray-800 text-xs overflow-x-auto">
        {result.success ? (
          <p className="text-gray-500">
            The call runs without reverting on current state. This does not mean it is safe; the risk verdict above decides that.
          </p>
        ) : (
          <p className={result.reverted === false ? 'text-yellow-400' : 'text-red-400'}>{result.error}</p>
        )}
      </div>
    </div>
  );
}
