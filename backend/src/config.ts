import 'dotenv/config';

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';

// Tatum gateway — the API key lives ONLY on the server (never shipped to a browser).
export const TATUM_API_KEY = req('TATUM_API_KEY');
export const TATUM_RPC_URL =
  process.env.TATUM_RPC_URL ?? `https://sui-${NETWORK}.gateway.tatum.io/`;

// gRPC Transaction Driver endpoint for WRITES (JSON-RPC tx submission is
// disabled network-wide; Tatum's gateway can't submit Sui txs).
export const SUI_GRPC_URL =
  process.env.SUI_GRPC_URL ?? `https://fullnode.${NETWORK}.sui.io:443`;

export const PACKAGE_ID = req('DATA_COOP_PACKAGE_ID');
export const SUI_PRIVATE_KEY = req('SUI_PRIVATE_KEY'); // suiprivkey1... (backend signer)

// Optional caps for the model-worker / settlement flow.
export const PROVIDER_CAP_ID = process.env.PROVIDER_CAP_ID;

// Seal testnet key servers (independent, open mode). 2-of-3 → set threshold 2.
export const SEAL_THRESHOLD = Number(process.env.SEAL_THRESHOLD ?? 2);
export const SEAL_KEY_SERVERS = (
  process.env.SEAL_KEY_SERVERS ??
  '0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const WALRUS_EPOCHS = Number(process.env.WALRUS_EPOCHS ?? 3);
// Upload relay — much more reliable than direct sliver writes to storage nodes.
export const WALRUS_UPLOAD_RELAY =
  process.env.WALRUS_UPLOAD_RELAY ?? `https://upload-relay.${NETWORK}.walrus.space`;
export const PORT = Number(process.env.PORT ?? 8787);
