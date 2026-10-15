"use client";

import { useBalance, useReadContract, useAccount } from "wagmi";
import { formatUnits } from "viem";
import { SEPOLIA_USDC, USDC_DECIMALS } from "@/lib/blockchain/rpc";

const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function BalanceCard() {
  const { address } = useAccount();

  const { data: ethBalance, isLoading: ethLoading } = useBalance({
    address,
    query: { refetchInterval: 30_000 },
  });

  const { data: usdcBalance, isLoading: usdcLoading } = useReadContract({
    address: SEPOLIA_USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { refetchInterval: 30_000, enabled: !!address },
  });

  const eth = ethBalance
    ? parseFloat(formatUnits(ethBalance.value, ethBalance.decimals)).toFixed(4)
    : "—";

  const usdc = usdcBalance !== undefined
    ? parseFloat(formatUnits(usdcBalance, USDC_DECIMALS)).toFixed(2)
    : "—";

  return (
    <div className="w-full max-w-md border border-white/10 p-6">
      <div className="text-xs text-white/40 tracking-widest mb-4">
        WALLET BALANCES · SEPOLIA
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-white/60">ETH</span>
          <span className="text-lg font-mono">
            {ethLoading ? "…" : eth}
          </span>
        </div>
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-white/60">USDC</span>
          <span className="text-lg font-mono">
            {usdcLoading ? "…" : usdc}
          </span>
        </div>
      </div>
    </div>
  );
}
