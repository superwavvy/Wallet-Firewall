import { ConnectButton } from '@/components/wallet/ConnectButton';
import { WalletGate } from '@/components/wallet/WalletGate';
import { BalanceCard } from '@/components/wallet/BalanceCard';
import { TransactionBuilder } from '@/components/firewall/TransactionBuilder';

export default function Home() {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex flex-col">
      <header className="border-b border-gray-800 p-6 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div className="w-4 h-4 bg-cyan-500"></div>
          <h1 className="text-xl tracking-widest uppercase font-bold">Wallet Firewall</h1>
        </div>
        <ConnectButton />
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
            Know what you're signing before you sign it.
          </h2>
          <p className="text-gray-500 text-sm md:text-base">
            Deterministic risk engine for EVM transactions. AI explains, never determines.
          </p>
        </div>

        <WalletGate>
          <div className="w-full flex flex-col items-center">
            <BalanceCard />
            <TransactionBuilder />
          </div>
        </WalletGate>
      </main>

      <footer className="border-t border-gray-800 p-6 text-center text-xs text-gray-600 tracking-widest uppercase">
        Never store private keys. Never sign transactions server-side.
      </footer>
    </div>
  );
}
