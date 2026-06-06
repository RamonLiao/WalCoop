import { createDAppKit } from '@mysten/dapp-kit-react';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { tatumEnabled } from './lib/tatum';

// RPC split:
//   • Wallet signing + waitForTransaction → dApp Kit gRPC client against the
//     public fullnode (documented gRPC-web support — don't gamble the critical
//     path on the unconfirmed gRPC-web compatibility of Tatum's gRPC endpoint).
//   • On-chain object READS → Tatum JSON-RPC gateway (verified working) via
//     lib/tatum.ts + lib/chain.ts.
// This keeps Tatum genuinely in the data path while the sign/execute path stays
// on the most reliable transport.

const GRPC_URLS: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
};

export const usingTatum = tatumEnabled;

export const dAppKit = createDAppKit({
  networks: ['testnet', 'mainnet'],
  defaultNetwork: 'testnet',
  createClient: (network) =>
    new SuiGrpcClient({ network, baseUrl: GRPC_URLS[network] }),
  autoConnect: true,
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  storageKey: 'walcoop_dappkit',
});

declare module '@mysten/dapp-kit-react' {
  interface Register {
    dAppKit: typeof dAppKit;
  }
}
