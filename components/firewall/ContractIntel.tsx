'use client';

import { useState, useEffect } from 'react';
import { getContractIntel } from '@/lib/contract-intel';

export function ContractIntel({ address }: { address: string }) {
  const [intel, setIntel] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchIntel() {
      if (!address) return;
      setLoading(true);
      const data = await getContractIntel(address);
      setIntel(data);
      setLoading(false);
    }
    fetchIntel();
  }, [address]);

  if (loading) return <div className="text-gray-500 text-xs mt-4 font-mono">Fetching contract intel...</div>;
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
