"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";

export function ConnectButton() {
  const [mounted, setMounted] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const { address, isConnected } = useAccount();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId || c.type === connectorId);
    if (connector) {
      connect({ connector });
      setShowPicker(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex flex-col items-end gap-2">
        <button disabled className="bg-white text-black px-5 py-2.5 text-sm font-medium opacity-50">
          Connect Wallet
        </button>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex flex-col items-end gap-2 relative">
        <button
          onClick={() => setShowPicker(!showPicker)}
          disabled={isPending}
          className="bg-white text-black px-5 py-2.5 text-sm font-medium hover:bg-white/90 disabled:opacity-40"
        >
          {isPending ? "Connecting..." : "Connect Wallet"}
        </button>

        {showPicker && (
          <div className="absolute top-full mt-2 right-0 bg-black border border-gray-800 w-64 z-50">
            <button
              onClick={() => handleConnect('injected')}
              className="w-full text-left p-3 text-sm text-white hover:bg-gray-900 border-b border-gray-800"
            >
              <div className="font-bold">Injected / MetaMask</div>
              <div className="text-xs text-gray-500">For dApp browsers</div>
            </button>
            <button
              onClick={() => handleConnect('walletConnect')}
              className="w-full text-left p-3 text-sm text-white hover:bg-gray-900"
            >
              <div className="font-bold">WalletConnect</div>
              <div className="text-xs text-gray-500">Scan QR with any wallet</div>
            </button>
          </div>
        )}

        {error && (
          <span className="text-xs text-red-500 max-w-[220px] text-right">
            {error.message}
          </span>
        )}
      </div>
    );
  }

  const wrongNetwork = chainId !== sepolia.id;

  return (
    <div className="flex items-center gap-3">
      {wrongNetwork && (
        <button
          onClick={() => switchChain({ chainId: sepolia.id })}
          className="border border-orange-500 text-orange-500 px-3 py-1.5 text-xs"
        >
          Wrong Network - Switch
        </button>
      )}
      <span className="text-sm font-mono">
        {address?.slice(0, 6)}...{address?.slice(-4)}
      </span>
      <button
        onClick={() => disconnect()}
        className="text-xs text-white/60 hover:text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
