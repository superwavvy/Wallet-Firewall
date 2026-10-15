"use client";

import { useAccount } from "wagmi";

export function WalletGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { isConnected } = useAccount();
  return <>{isConnected ? children : fallback}</>;
}
