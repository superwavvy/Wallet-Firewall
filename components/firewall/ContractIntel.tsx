export function ContractIntel({ intel }: { intel: any }) {
  if (!intel) return null;

  return (
    <div className="mt-6 border-t border-gray-800 pt-6">
      <h3 className="text-gray-400 mb-3 uppercase tracking-wider font-mono">Contract Intel</h3>
      <div className="bg-gray-950 p-4 border border-gray-800 overflow-x-auto text-xs text-yellow-400 font-mono">
        <pre>{JSON.stringify(intel, null, 2)}</pre>
      </div>
    </div>
  );
}
