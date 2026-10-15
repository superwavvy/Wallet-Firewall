'use client';

import { useState } from 'react';
import { isAddress, parseEther } from 'viem';
import { useAccount, useSendTransaction } from 'wagmi';
import { decodeTransaction } from '@/lib/decoder';
import { getContractIntel } from '@/lib/contract-intel';
import { analyzeRisk, RiskReport } from '@/lib/risk-engine';
import { simulateTransaction } from '@/lib/simulator';
import { sepoliaClient, mainnetClient } from '@/lib/blockchain/rpc';
import { ContractIntel } from './ContractIntel';
import { RiskReportCard } from './RiskReportCard';
import { SimulationCard } from './SimulationCard';

export function TransactionBuilder() {
  const { address } = useAccount();
  const { sendTransaction, isPending: isSending, error: sendError, data: txHash } = useSendTransaction();
  const [network, setNetwork] = useState<'sepolia' | 'mainnet'>('sepolia');
  const [to, setTo] = useState('');
  const [value, setValue] = useState('');
  const [data, setData] = useState('');
  const [rawTx, setRawTx] = useState<{to: string, value: string, data: string} | null>(null);
  const [decodedTx, setDecodedTx] = useState<any>(null);
  const [intel, setIntel] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleInspect = async () => {
    setError('');
    setDecodedTx(null);
    setIntel(null);
    setRiskReport(null);
    setSimulation(null);
    setLoading(true);

    if (!address) {
      setError('Wallet not connected.');
      setLoading(false);
      return;
    }

    if (!isAddress(to)) {
      setError('Invalid recipient address.');
      setLoading(false);
      return;
    }

    let valueInWei = '0';
    try {
      if (value) valueInWei = parseEther(value).toString();
    } catch (e) {
      setError('Invalid ETH amount.');
      setLoading(false);
      return;
    }

    let sanitizedData = data.trim();
    if (sanitizedData && !sanitizedData.startsWith('0x')) sanitizedData = '0x' + sanitizedData;
    if (sanitizedData === '0x') sanitizedData = '';

    const payload = { to, value: valueInWei, data: sanitizedData };
    setRawTx(payload);

    const decoded = decodeTransaction(payload);
    setDecodedTx(decoded);

    const client = network === 'sepolia' ? sepoliaClient : mainnetClient;

    const contractIntel = await getContractIntel(client, payload.to);
    setIntel(contractIntel);

    const report = analyzeRisk(payload, decoded, contractIntel);
    setRiskReport(report);

    const simResult = await simulateTransaction(client, payload, address);
    setSimulation(simResult);
    
    setLoading(false);
  };

  const handleSign = () => {
    if (!rawTx) return;
    
    // Safety check: Ensure Mainnet is read-only for now
    if (network === 'mainnet') {
      alert("Signing on Mainnet is disabled in this phase. Switch to Sepolia to test signing.");
      return;
    }

    sendTransaction({
      to: rawTx.to as `0x${string}`,
      value: BigInt(rawTx.value),
      data: rawTx.data as `0x${string}`,
    });
  };

  const isBlocked = riskReport?.verdict === 'BLOCK';

  return (
    <div className="border border-gray-800 bg-black p-6 w-full max-w-2xl font-mono text-sm mt-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-gray-400 uppercase tracking-wider">Construct Transaction</h2>
        <select 
          value={network} 
          onChange={(e) => setNetwork(e.target.value as 'sepolia' | 'mainnet')}
          className="bg-gray-950 border border-gray-800 p-1 text-xs text-white outline-none"
        >
          <option value="sepolia">Sepolia (Testnet)</option>
          <option value="mainnet">Ethereum Mainnet (Read-Only)</option>
        </select>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-gray-500 mb-1">To Address</label>
          <input type="text" placeholder="0x..." value={to} onChange={(e) => setTo(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 p-2 text-white outline-none focus:border-gray-600" />
        </div>

        <div>
          <label className="block text-gray-500 mb-1">Value (ETH)</label>
          <input type="text" placeholder="0.0" value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 p-2 text-white outline-none focus:border-gray-600" />
        </div>

        <div>
          <label className="block text-gray-500 mb-1">Calldata (Hex, Optional)</label>
          <input type="text" placeholder="0x..." value={data} onChange={(e) => setData(e.target.value)}
            className="w-full bg-gray-950 border border-gray-800 p-2 text-white outline-none focus:border-gray-600" />
        </div>

        {error && <div className="text-red-500 text-xs">{error}</div>}

        <button onClick={handleInspect} disabled={loading || isSending}
          className="w-full bg-white text-black font-bold p-3 mt-4 hover:bg-gray-200 transition-colors uppercase disabled:bg-gray-600 disabled:text-gray-400">
          {loading ? 'Analyzing...' : 'Inspect Transaction'}
        </button>
      </div>

      {riskReport && <RiskReportCard report={riskReport} />}
      {simulation && <SimulationCard result={simulation} />}

      {riskReport && (
        <div className="mt-6">
          <button 
            onClick={handleSign}
            disabled={isBlocked || loading || isSending}
            className={`w-full font-bold p-4 uppercase tracking-widest transition-colors ${
              isBlocked 
                ? 'bg-red-950 border-2 border-red-800 text-red-500 cursor-not-allowed' 
                : isSending
                ? 'bg-yellow-600 text-black cursor-wait'
                : 'bg-green-600 text-black hover:bg-green-500'
            }`}
          >
            {isBlocked 
              ? '🚫 BLOCKED BY FIREWALL' 
              : isSending 
              ? '⏳ CONFIRM IN WALLET...' 
              : 'Proceed to Sign →'}
          </button>
          
          {isBlocked && (
            <p className="text-center text-red-500 text-xs mt-2">
              This transaction has been blocked due to critical security risks.
            </p>
          )}

          {txHash && (
            <div className="mt-4 p-3 bg-green-950/30 border border-green-800 text-center">
              <p className="text-green-400 text-xs font-bold mb-1">Transaction Submitted!</p>
              <p className="text-gray-400 text-[10px] break-all">{txHash}</p>
            </div>
          )}

          {sendError && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-800 text-center">
              <p className="text-red-400 text-xs font-bold mb-1">Signing Failed</p>
              <p className="text-gray-400 text-[10px]">{sendError.message}</p>
            </div>
          )}
        </div>
      )}

      {rawTx && (
        <div className="mt-8 border-t border-gray-800 pt-6">
          <h3 className="text-gray-500 mb-2 uppercase tracking-wider text-xs">Raw Payload</h3>
          <div className="bg-gray-950 p-3 border border-gray-800 overflow-x-auto text-[10px] text-gray-500">
            <pre>{JSON.stringify(rawTx, null, 2)}</pre>
          </div>
        </div>
      )}

      {decodedTx && (
        <div className="mt-4 border-t border-gray-800 pt-6">
          <h3 className="text-gray-500 mb-2 uppercase tracking-wider text-xs">Decoded Output</h3>
          <div className="bg-gray-950 p-3 border border-gray-800 overflow-x-auto text-[10px] text-gray-500">
            <pre>{JSON.stringify(decodedTx, null, 2)}</pre>
          </div>
        </div>
      )}

      {intel && <ContractIntel address={intel.address} />}
    </div>
  );
}
