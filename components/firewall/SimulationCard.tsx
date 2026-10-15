'use client';

export function SimulationCard({ result }: { result: any }) {
  if (!result) return null;
  
  const color = result.success ? 'text-green-400 border-green-800' : 'text-red-500 border-red-800';
  
  return (
    <div className={`mt-6 border ${color} bg-gray-950 p-6 font-mono text-sm`}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-gray-400 uppercase tracking-wider">Simulation Result</h3>
        <span className={`font-bold ${result.success ? 'text-green-400' : 'text-red-500'}`}>
          {result.success ? 'PASSED' : 'REVERTED'}
        </span>
      </div>
      <div className="bg-gray-900 p-3 border border-gray-800 text-xs overflow-x-auto">
        {result.success ? (
          <p className="text-gray-500">Transaction would succeed based on current state.</p>
        ) : (
          <p className="text-red-400">{result.error}</p>
        )}
      </div>
    </div>
  );
}
