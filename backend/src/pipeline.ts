import { createHash } from 'node:crypto';
import { SessionKey } from '@mysten/seal';
import { fromHex } from '@mysten/sui/utils';
import { sealClient, walrusClient, keypair, suiClient, ADDRESS } from './clients.js';
import { PACKAGE_ID, SEAL_THRESHOLD, WALRUS_EPOCHS } from './config.js';
import {
  registerDataset,
  updateBlob,
  buildSealApproveTxBytes,
  settleCampaign,
} from './contracts.js';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder().decode(b);

async function walrusWrite(bytes: Uint8Array): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { blobId } = await walrusClient.writeBlob({
        blob: bytes,
        deletable: false,
        epochs: WALRUS_EPOCHS,
        signer: keypair,
      });
      return blobId;
    } catch (e) {
      lastErr = e;
      console.warn(`  walrus write attempt ${attempt} failed: ${(e as Error).message}`);
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw lastErr;
}

/**
 * Dataset Pipeline — the encryption id MUST equal the dataset's object id, but
 * that id only exists after registration. So:
 *   1. register a placeholder Dataset → get its id
 *   2. Seal-encrypt the data under id = dataset object id
 *   3. store the ciphertext on Walrus
 *   4. update_blob to point the Dataset at the real Walrus blob
 */
export async function publishDataset(args: {
  name: string;
  data: Uint8Array; // plaintext (already anonymized/aggregated)
  unitPrice: bigint;
  revShareBps: number;
}): Promise<{ datasetId: string; blobId: string }> {
  // 1. register placeholder
  const datasetId = await registerDataset({
    blobId: enc('pending'),
    sealInnerId: enc('pending'),
    schemaUri: enc(`schema:${args.name}`),
    name: args.name,
    unitPrice: args.unitPrice,
    revShareBps: args.revShareBps,
  });

  // 2. encrypt under id = dataset object id (matches access::seal_approve)
  const { encryptedObject } = await sealClient.encrypt({
    threshold: SEAL_THRESHOLD,
    packageId: PACKAGE_ID,
    id: datasetId, // hex identity; seal_approve does object::id_from_bytes(id)
    data: args.data,
  });

  // 3. store ciphertext on Walrus
  const blobId = await walrusWrite(encryptedObject);

  // 4. bind the Dataset to the real blob; seal_inner_id = dataset id bytes
  await updateBlob(datasetId, enc(blobId), fromHex(datasetId.replace(/^0x/, '')));

  return { datasetId, blobId };
}

/**
 * Model Worker — for each authorized dataset: decrypt via Seal (gated by the
 * on-chain AccessTicket), "train" a toy model, write a report to Walrus, then
 * settle the campaign so revenue is split on-chain.
 *
 * Requires: this backend address == campaign.model_provider, owns the
 * AccessTicket and a ProviderCap bound to it.
 */
export async function runModelWorker(args: {
  campaignId: string;
  ticketId: string;
  providerCapId: string;
  datasets: { datasetId: string; walrusBlobId: string }[];
}): Promise<{ reportBlobId: string; digest: string }> {
  // Session key signed by the provider keypair (== ticket.provider).
  const sessionKey = await SessionKey.create({
    address: ADDRESS,
    packageId: PACKAGE_ID,
    ttlMin: 10,
    signer: keypair,
    suiClient,
  });

  const perDataset: Record<string, unknown> = {};
  for (const ds of args.datasets) {
    const txBytes = await buildSealApproveTxBytes(ds.datasetId, args.ticketId);
    const ciphertext = await walrusClient.readBlob({ blobId: ds.walrusBlobId });
    const plaintext = await sealClient.decrypt({ data: ciphertext, sessionKey, txBytes });
    perDataset[ds.datasetId] = toyModel(plaintext);
  }

  // Toy "training report" → Walrus.
  const report = {
    campaignId: args.campaignId,
    model: 'toy-topk-v0',
    trainedAt: new Date().toISOString(),
    perDataset,
  };
  const reportBytes = enc(JSON.stringify(report));
  const reportBlobId = await walrusWrite(reportBytes);

  // Hash of the report content — providers can recompute against the blob.
  const usageStatsHash = sha256(reportBytes);

  const { digest } = await settleCampaign({
    providerCapId: args.providerCapId,
    campaignId: args.campaignId,
    orderedDatasetIds: args.datasets.map((d) => d.datasetId),
    usageStatsHash,
    reportBlobId: enc(reportBlobId),
  });

  return { reportBlobId, digest };
}

/** Stand-in for a real model: top-K most frequent tokens in the data. */
function toyModel(plaintext: Uint8Array): { topK: [string, number][]; rows: number } {
  let rows = 0;
  const counts = new Map<string, number>();
  for (const line of dec(plaintext).split('\n')) {
    if (!line.trim()) continue;
    rows++;
    const key = line.split(',')[0]?.trim() ?? line.trim();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const topK = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  return { topK, rows };
}

function sha256(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(bytes).digest());
}
