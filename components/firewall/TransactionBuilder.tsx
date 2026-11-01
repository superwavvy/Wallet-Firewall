'use client';

import { useState } from 'react';
import { isAddress, parseEther } from 'viem';
import { useAccount, useChainId, useSendTransaction } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { decodeTransaction } from '@/lib/decoder';
import { getContractIntel } from '@/lib/contract-intel';
import { analyzeRisk, RiskReport } from '@/lib/risk-engine';
import { simulateTransaction } from '@/lib/simulator';
import { sepoliaClient, mainnetClient, SEPOLIA_USDC } from '@/lib/blockchain/rpc';
import { ContractIntel } from './ContractIntel';
import { RiskReportCard } from './RiskReportCard';
import { SimulationCard } from './SimulationCard';

type TxPayload = {
  to: string;
  value: string;
  data: string;
  authorizationList?: { address: string; chainId: number }[];
};

// Placeholder sender used when no wallet is connected (demo mode)
const DEMO_SENDER = '0x000000000000000000000000000000000000dead';

const SPENDER = '1111111111111111111111111111111111111111';
const MAX_UINT = 'f'.repeat(64);

// value is in ETH here (same format as the input field)
const PRESETS: { label: string; tx: TxPayload }[] = [
  { label: 'Safe transfer', tx: { to: '0x1111111111111111111111111111111111111111', value: '0.001', data: '' } },
  { label: 'Unlimited approval', tx: { to: SEPOLIA_USDC, value: '0', data: '0x095ea7b3' + '0'.repeat(24) + SPENDER + MAX_UINT } },
  { label: 'Calldata to EOA', tx: { to: '0x2222222222222222222222222222222222222222', value: '0', data: '0xdeadbeef' } },
  { label: '7702 authorization', tx: { to: '0x1111111111111111111111111111111111111111', value: '0', data: '', authorizationList: [{ address: '0x3333333333333333333333333333333333333333', chainId: 0 }] } },
];

export function TransactionBuilder() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { sendTransaction, isPending: isSending, error: sendError, data: txHash } = useSendTransaction();
  const [network, setNetwork] = useState<'sepolia' | 'mainnet'>('sepolia');
  const [to, setTo] = useState('');
  const [value, setValue] = useState('');
  const [data, setData] = useState('');
  const [rawTx, setRawTx] = useState<TxPayload | null>(null);
  const [decodedTx, setDecodedTx] = useState<any>(null);
  const [intel, setIntel] = useState<any>(null);
  const [riskReport, setRiskReport] = useState<RiskReport | null>(null);
  const [simulation, setSimulation] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const demo = !address;
  const wrongChain = !!address && chainId !== sepolia.id;

  const inspect = async (input: TxPayload, net: 'sepolia' | 'mainnet' = network) => {
    setError('');
    setDecodedTx(null);
    setIntel(null);
    setRiskReport(null);
    setSimulation(null);
    setLoading(true);

    if (!isAddress(input.to)) {
      setError('Invalid recipient address.');
      setLoading(false);
      return;
    }

    let valueInWei = '0';
    try {
      if (input.value) valueInWei = parseEther(input.value).toString();
    } catch (e) {
      setError('Invalid ETH amount.');
      setLoading(false);
      return;
    }

    let sanitizedData = input.data.trim();
    if (sanitizedData && !sanitizedData.startsWith('0x')) sanitizedData = '0x' + sanitizedData;
    if (sanitizedData === '0x') sanitizedData = '';

    const payload: TxPayload = { to: input.to, value: valueInWei, data: sanitizedData };
    if (input.authorizationList) payload.authorizationList = input.authorizationList;
    setRawTx(payload);

    const decoded = decodeTransaction(payload);
    setDecodedTx(decoded);

    const client = net === 'sepolia' ? sepoliaClient : mainnetClient;

    const contractIntel = await getContractIntel(client, payload.to);
    setIntel(contractIntel);

    const senderIntel = address ? await getContractIntel(client, address) : null;

    const simResult = await simulateTransaction(client, payload, address ?? DEMO_SENDER, { fundSender: demo });
    setSimulation(simResult);

    const report = analyzeRisk(payload, decoded, contractIntel, senderIntel, simResult);
    setRiskReport(report);

    setLoading(false);
  };

  const handleInspect = () => inspect({ to, value, data });

  const runPreset = (tx: TxPayload) => {
    setNetwork('sepolia');
    setTo(tx.to);
    setValue(tx.value);
    setData(tx.data);
    inspect(tx, 'sepolia');
  };

  const handleSign = () => {
    if (!rawTx) return;
    
    // Safety check: Ensure Mainnet is read-only for now
    if (network === 'mainnet') {
      alert("Signing on Mainnet is disabled in this phase. Switch to Sepolia to test signing.");
      return;
    }

    sendTransaction({
      chainId: sepolia.id,
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
      
      {demo && (
        <p className="text-[11px] text-gray-500 mb-4">
          Demo mode: no wallet connected. Analysis works; connect a wallet to sign on Sepolia.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <span className="text-gray-500 text-xs">Try:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => runPreset(p.tx)}
            disabled={loading || isSending}
            className="border border-gray-700 px-2 py-1 text-xs text-gray-300 hover:border-gray-400 disabled:opacity-50"
          >
            {p.label}
          </button>
        ))}
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
            disabled={isBlocked || loading || isSending || demo || wrongChain}
            className={`w-full font-bold p-4 uppercase tracking-widest transition-colors ${
              isBlocked 
                ? 'bg-red-950 border-2 border-red-800 text-red-500 cursor-not-allowed' 
                : demo || wrongChain
                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                : isSending
                ? 'bg-yellow-600 text-black cursor-wait'
                : 'bg-green-600 text-black hover:bg-green-500'
            }`}
          >
            {isBlocked 
              ? '🚫 BLOCKED BY FIREWALL' 
              : wrongChain
              ? 'Switch wallet to Sepolia to sign'
              : demo
              ? 'Connect a wallet to sign'
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
        <details className="mt-8 border-t border-gray-800 pt-6">
          <summary className="cursor-pointer text-gray-500 uppercase tracking-wider text-xs">Details: Raw Payload</summary>
          <div className="mt-2 bg-gray-950 p-3 border border-gray-800 overflow-x-auto text-[10px] text-gray-500">
            <pre>{JSON.stringify(rawTx, null, 2)}</pre>
          </div>
        </details>
      )}

      {decodedTx && (
        <details className="mt-4 border-t border-gray-800 pt-6">
          <summary className="cursor-pointer text-gray-500 uppercase tracking-wider text-xs">Details: Decoded Output</summary>
          <div className="mt-2 bg-gray-950 p-3 border border-gray-800 overflow-x-auto text-[10px] text-gray-500">
            <pre>{JSON.stringify(decodedTx, null, 2)}</pre>
          </div>
        </details>
      )}

      {intel && <ContractIntel intel={intel} />}
    </div>
  );
}
