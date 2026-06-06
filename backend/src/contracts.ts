import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID, fromHex } from '@mysten/sui/utils';
import { suiClient, keypair } from './clients.js';
import { PACKAGE_ID } from './config.js';

const SUI_COIN = '0x2::sui::SUI';
const t = (mod: string, fn: string) => `${PACKAGE_ID}::${mod}::${fn}`;
const u8 = (tx: Transaction, b: Uint8Array) => tx.pure.vector('u8', Array.from(b));

/** Sign + execute a PTB, wait for finality, return digest + created object ids. */
export async function executeTx(
  build: (tx: Transaction) => void,
): Promise<{ digest: string; created: { id: string; type: string }[] }> {
  const tx = new Transaction();
  build(tx);
  tx.setSenderIfNotSet(keypair.toSuiAddress());

  const res: any = await suiClient.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    include: { effects: true, objectTypes: true },
  });
  if (res.FailedTransaction) {
    const err = res.FailedTransaction.status?.error;
    throw new Error(`tx failed: ${err?.description ?? JSON.stringify(err) ?? 'unknown'}`);
  }

  const txr = res.Transaction;
  const digest: string = txr.digest;
  await (suiClient as any).waitForTransaction?.({ digest });

  // gRPC shape: effects.changedObjects[] has objectId + idOperation; types are
  // in a separate objectTypes map (objectId -> fully-qualified type).
  const objectTypes: Record<string, string> = txr.objectTypes ?? {};
  const created: { id: string; type: string }[] = (txr.effects?.changedObjects ?? [])
    .filter((c: any) => c.idOperation === 'Created')
    .map((c: any) => ({ id: c.objectId, type: objectTypes[c.objectId] ?? '' }));
  return { digest, created };
}

const createdOfType = (created: { id: string; type: string }[], needle: string) =>
  created.find((c) => c.type.includes(needle))?.id;

// === acl ===

export async function grantProviderCap(publisherCapId: string, provider: string): Promise<string> {
  const { created } = await executeTx((tx) => {
    tx.moveCall({
      target: t('acl', 'grant_and_transfer_provider_cap'),
      arguments: [tx.object(publisherCapId), tx.pure.address(provider)],
    });
  });
  const id = createdOfType(created, '::acl::ProviderCap');
  if (!id) throw new Error('grant: ProviderCap id not found');
  return id;
}

// === campaign ===

export async function createCampaign(
  modelProvider: string,
  datasetIds: string[],
  coinType = SUI_COIN,
): Promise<string> {
  const { created } = await executeTx((tx) => {
    const b = tx.moveCall({
      target: t('campaign', 'new_campaign'),
      typeArguments: [coinType],
      arguments: [tx.pure.address(modelProvider), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
    for (const dsId of datasetIds) {
      tx.moveCall({
        target: t('campaign', 'add_dataset'),
        typeArguments: [coinType],
        arguments: [b, tx.object(dsId)],
      });
    }
    tx.moveCall({ target: t('campaign', 'share_campaign'), typeArguments: [coinType], arguments: [b] });
  });
  const id = createdOfType(created, '::campaign::Campaign');
  if (!id) throw new Error('create_campaign: Campaign id not found');
  return id;
}

export async function fundCampaign(campaignId: string, amount: bigint, coinType = SUI_COIN) {
  return executeTx((tx) => {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    tx.moveCall({
      target: t('campaign', 'fund_campaign'),
      typeArguments: [coinType],
      arguments: [tx.object(campaignId), coin],
    });
  });
}

export async function issueAccessTicket(
  campaignId: string,
  expiryMs: bigint,
  coinType = SUI_COIN,
): Promise<string> {
  const { created } = await executeTx((tx) => {
    tx.moveCall({
      target: t('campaign', 'issue_access_ticket'),
      typeArguments: [coinType],
      arguments: [tx.object(campaignId), tx.pure.u64(expiryMs), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
  });
  const id = createdOfType(created, '::campaign::AccessTicket');
  if (!id) throw new Error('issue_access_ticket: AccessTicket id not found');
  return id;
}

// === dataset ===

export async function registerDataset(args: {
  blobId: Uint8Array;
  sealInnerId: Uint8Array;
  schemaUri: Uint8Array;
  name: string;
  unitPrice: bigint;
  revShareBps: number;
  pricingModel?: number;
}): Promise<string> {
  const { created } = await executeTx((tx) => {
    const pricing = tx.moveCall({
      target: t('dataset', 'new_pricing'),
      arguments: [tx.pure.u8(args.pricingModel ?? 0), tx.pure.u64(args.unitPrice)],
    });
    tx.moveCall({
      target: t('dataset', 'register_dataset'),
      arguments: [
        u8(tx, args.blobId),
        u8(tx, args.sealInnerId),
        u8(tx, args.schemaUri),
        tx.pure.string(args.name),
        pricing,
        tx.pure.u16(args.revShareBps),
      ],
    });
  });
  const id = createdOfType(created, '::dataset::Dataset');
  if (!id) throw new Error('register_dataset: Dataset object id not found in effects');
  return id;
}

export async function updateBlob(datasetId: string, blobId: Uint8Array, sealInnerId: Uint8Array) {
  return executeTx((tx) => {
    tx.moveCall({
      target: t('dataset', 'update_blob'),
      arguments: [tx.object(datasetId), u8(tx, blobId), u8(tx, sealInnerId)],
    });
  });
}

// === access (Seal policy PTB — built, not executed) ===

/** Build the seal_approve TransactionKind bytes the key servers dry-run. */
export async function buildSealApproveTxBytes(datasetId: string, ticketId: string): Promise<Uint8Array> {
  const tx = new Transaction();
  // AccessTicket is an OWNED object — its input ref only resolves when the
  // sender (= ticket owner = provider) is known, even for onlyTransactionKind.
  tx.setSender(keypair.toSuiAddress());
  tx.moveCall({
    target: t('access', 'seal_approve'),
    arguments: [
      tx.pure.vector('u8', Array.from(fromHex(datasetId.replace(/^0x/, '')))),
      tx.object(ticketId),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });
  return tx.build({ client: suiClient as any, onlyTransactionKind: true });
}

// === settlement (begin -> pay xN -> finish in one PTB) ===

export async function settleCampaign(args: {
  providerCapId: string;
  campaignId: string;
  orderedDatasetIds: string[];
  usageStatsHash: Uint8Array;
  reportBlobId: Uint8Array;
  coinType?: string;
}) {
  const T = args.coinType ?? SUI_COIN;
  return executeTx((tx) => {
    const s = tx.moveCall({
      target: t('settlement', 'begin_settlement'),
      typeArguments: [T],
      arguments: [
        tx.object(args.providerCapId),
        tx.object(args.campaignId),
        u8(tx, args.usageStatsHash),
        u8(tx, args.reportBlobId),
      ],
    });
    for (const dsId of args.orderedDatasetIds) {
      tx.moveCall({
        target: t('settlement', 'pay_dataset'),
        typeArguments: [T],
        arguments: [s, tx.object(args.campaignId), tx.object(dsId)],
      });
    }
    tx.moveCall({
      target: t('settlement', 'finish_settlement'),
      typeArguments: [T],
      arguments: [s, tx.object(args.campaignId), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
  });
}
