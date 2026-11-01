import { createConfig, http } from "wagmi";
import { sepolia, mainnet } from "wagmi/chains";
import { injected } from "wagmi/connectors/injected";
import { walletConnect } from "wagmi/connectors/walletConnect";

const projectId = "5f29bbc58e196a09b032d0251fb7688d";

if (!projectId) {
  console.warn("WARNING: NEXT_PUBLIC_WC_PROJECT_ID is missing from .env.local");
}

export const wagmiConfig = createConfig({
  chains: [sepolia, mainnet],
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
    [mainnet.id]: http(process.env.NEXT_PUBLIC_MAINNET_RPC_URL),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
