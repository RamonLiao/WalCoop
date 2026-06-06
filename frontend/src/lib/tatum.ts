// Tatum gateway JSON-RPC client (sponsor infra). The JSON-RPC gateway is
// verified working with the API key; we use it for on-chain READS so the Tatum
// integration has a proven path (the gRPC gateway's gRPC-web compatibility is
// unconfirmed). Wallet signing still goes through dApp Kit.
//
// ⚠️ Key ships in the client bundle — testnet key for the demo. Proxy via a
// backend for production.

const KEY = (import.meta as any).env?.VITE_TATUM_API_KEY as string | undefined;

const URLS: Record<string, string> = {
  testnet: 'https://sui-testnet.gateway.tatum.io/',
  mainnet: 'https://sui-mainnet.gateway.tatum.io/',
};

export const tatumEnabled = Boolean(KEY);

export async function tatumRpc(
  method: string,
  params: unknown[],
  network: string = 'testnet',
): Promise<any> {
  const res = await fetch(URLS[network] ?? URLS.testnet, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(KEY ? { 'x-api-key': KEY } : {}),
    },
    body: JSON.stringify({ id: 1, jsonrpc: '2.0', method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? 'Tatum RPC error');
  return json.result;
}

export const tatumGetObject = (id: string, network?: string) =>
  tatumRpc('sui_getObject', [id, { showContent: true }], network);

export const tatumLatestCheckpoint = (network?: string) =>
  tatumRpc('sui_getLatestCheckpointSequenceNumber', [], network);
