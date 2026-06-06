import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiJsonRpcClient, JsonRpcHTTPTransport } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SealClient } from '@mysten/seal';
import { WalrusClient } from '@mysten/walrus';
import {
  NETWORK,
  TATUM_API_KEY,
  TATUM_RPC_URL,
  SUI_GRPC_URL,
  SUI_PRIVATE_KEY,
  SEAL_KEY_SERVERS,
  WALRUS_UPLOAD_RELAY,
} from './config.js';

export const keypair = Ed25519Keypair.fromSecretKey(SUI_PRIVATE_KEY);
export const ADDRESS = keypair.toSuiAddress();

// WRITES + Seal + Walrus: gRPC Transaction Driver. JSON-RPC tx submission is
// disabled network-wide (Quorum Driver off), so this is the only execution
// path. Same transport the frontend proved working.
export const suiClient = new SuiGrpcClient({ network: NETWORK, baseUrl: SUI_GRPC_URL });

// READS via the Tatum gateway (sponsor infra) — getObject / checkpoint work
// here; only tx submission doesn't. Retries on 429 (free-tier rate limit).
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const retryingFetch: typeof fetch = async (input, init) => {
  let last: Response | undefined;
  for (let i = 0; i < 6; i++) {
    last = await fetch(input, init);
    if (last.status !== 429) return last;
    await sleep(400 * 2 ** i + Math.floor(Math.random() * 200));
  }
  return last!;
};
export const tatumReadClient = new SuiJsonRpcClient({
  network: NETWORK,
  transport: new JsonRpcHTTPTransport({
    url: TATUM_RPC_URL,
    fetch: retryingFetch,
    rpc: { headers: { 'x-api-key': TATUM_API_KEY } },
  }),
});

export const sealClient = new SealClient({
  suiClient,
  serverConfigs: SEAL_KEY_SERVERS.map((objectId) => ({ objectId, weight: 1 })),
  verifyKeyServers: false,
});

export const walrusClient = new WalrusClient({
  network: NETWORK,
  suiClient,
  uploadRelay: {
    host: WALRUS_UPLOAD_RELAY,
    // Cap the tip the relay may charge (paid in MIST).
    sendTip: { max: 10_000_000 },
  },
});
