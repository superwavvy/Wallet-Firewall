import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";

const projectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID;

if (!projectId) {
  console.warn("WARNING: NEXT_PUBLIC_WC_PROJECT_ID is missing from .env.local");
}

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [
    injected(),
    walletConnect({ 
      projectId: projectId || "MISSING",
      showQrModal: true,
      metadata: {
        name: "Wallet Firewall",
        description: "Know what you're signing before you sign it.",
        url: typeof window !== 'undefined' ? window.location.origin : "https://wallet-firewall.local",
        icons: [],
      },
    }),
  ],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL),
  },
  ssz: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
