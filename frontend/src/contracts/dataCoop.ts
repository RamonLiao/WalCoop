import { Transaction, type TransactionObjectArgument } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import {
  type Campaign,
  type Dataset,
  type AccessTicket,
  type UsageRecord,
  CampaignStatus,
  PricingModel,
} from './types';

const SUI_TYPE = '0x2::sui::SUI';

function u8vec(tx: Transaction, bytes: Uint8Array) {
  return tx.pure.vector('u8', Array.from(bytes));
}

/**
 * Type-safe PTB builders for the `data_coop` package.
 *
 * Several flows use Move hot-potato builders (`CampaignBuilder`, `Settlement`)
 * and `public fun`s that return values — these MUST be chained inside a single
 * PTB, which is exactly what these helpers do. `coinType` defaults to SUI.
 */
export class DataCoopClient {
  constructor(
    private readonly packageId: string,
    private readonly coinType: string = SUI_TYPE,
  ) {}

  private target(mod: string, fn: string) {
    return `${this.packageId}::${mod}::${fn}` as const;
  }

  // === dataset ===

  /** Retailer: encrypt+upload off-chain first, then register the pointer. */
  registerDataset(
    tx: Transaction,
    args: {
      blobId: Uint8Array;
      sealInnerId: Uint8Array;
      schemaUri: Uint8Array;
      name: string;
      pricingModel: PricingModel;
      unitPrice: bigint;
      revShareBps: number;
    },
  ): Transaction {
    const pricing = tx.moveCall({
      target: this.target('dataset', 'new_pricing'),
      arguments: [tx.pure.u8(args.pricingModel), tx.pure.u64(args.unitPrice)],
    });
    tx.moveCall({
      target: this.target('dataset', 'register_dataset'),
      arguments: [
        u8vec(tx, args.blobId),
        u8vec(tx, args.sealInnerId),
        u8vec(tx, args.schemaUri),
        tx.pure.string(args.name),
        pricing,
        tx.pure.u16(args.revShareBps),
      ],
    });
    return tx;
  }

  updateBlob(tx: Transaction, datasetId: string, newBlobId: Uint8Array, newSealInnerId: Uint8Array): Transaction {
    tx.moveCall({
      target: this.target('dataset', 'update_blob'),
      arguments: [tx.object(datasetId), u8vec(tx, newBlobId), u8vec(tx, newSealInnerId)],
    });
    return tx;
  }

  setListed(tx: Transaction, datasetId: string, listed: boolean): Transaction {
    tx.moveCall({
      target: this.target('dataset', 'set_listed'),
      arguments: [tx.object(datasetId), tx.pure.bool(listed)],
    });
    return tx;
  }

  // === campaign (hot-potato builder flow) ===

  /**
   * Brand: build + share a campaign over `datasetIds` in ONE PTB.
   * Order of `datasetIds` is recorded on-chain and MUST be reused at settlement.
   */
  createCampaign(tx: Transaction, args: { modelProvider: string; datasetIds: string[] }): Transaction {
    const builder = tx.moveCall({
      target: this.target('campaign', 'new_campaign'),
      typeArguments: [this.coinType],
      arguments: [tx.pure.address(args.modelProvider), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
    for (const dsId of args.datasetIds) {
      tx.moveCall({
        target: this.target('campaign', 'add_dataset'),
        typeArguments: [this.coinType],
        arguments: [builder, tx.object(dsId)],
      });
    }
    tx.moveCall({
      target: this.target('campaign', 'share_campaign'),
      typeArguments: [this.coinType],
      arguments: [builder],
    });
    return tx;
  }

  /**
   * Brand: fund the campaign (-> Active). For SUI, pass `amount` to split from
   * gas; for other coins, pass a `coin` argument (object id or PTB result).
   */
  fundCampaign(
    tx: Transaction,
    args: { campaignId: string; amount?: bigint; coin?: string | TransactionObjectArgument },
  ): Transaction {
    let payment: TransactionObjectArgument;
    if (args.coin !== undefined) {
      payment = typeof args.coin === 'string' ? tx.object(args.coin) : args.coin;
    } else {
      if (args.amount === undefined) throw new Error('fundCampaign: provide amount (SUI) or coin');
      [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(args.amount)]);
    }
    tx.moveCall({
      target: this.target('campaign', 'fund_campaign'),
      typeArguments: [this.coinType],
      arguments: [tx.object(args.campaignId), payment],
    });
    return tx;
  }

  /** Brand: issue a time-boxed AccessTicket to the model provider (requires budget >= price floor). */
  issueAccessTicket(tx: Transaction, args: { campaignId: string; expiryMs: bigint }): Transaction {
    tx.moveCall({
      target: this.target('campaign', 'issue_access_ticket'),
      typeArguments: [this.coinType],
      arguments: [tx.object(args.campaignId), tx.pure.u64(args.expiryMs), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
    return tx;
  }

  /** Brand: reclaim budget if never settled (-> Cancelled). */
  cancelCampaign(tx: Transaction, campaignId: string): Transaction {
    tx.moveCall({
      target: this.target('campaign', 'cancel_campaign'),
      typeArguments: [this.coinType],
      arguments: [tx.object(campaignId)],
    });
    return tx;
  }

  // === settlement (hot-potato begin -> pay xN -> finish) ===

  /**
   * Model Provider: settle in ONE PTB. `orderedDatasetIds` MUST match the
   * campaign's recorded basket order (the same order used in createCampaign).
   */
  settleCampaign(
    tx: Transaction,
    args: {
      providerCapId: string;
      campaignId: string;
      orderedDatasetIds: string[];
      usageStatsHash: Uint8Array;
      reportBlobId: Uint8Array;
    },
  ): Transaction {
    const settlement = tx.moveCall({
      target: this.target('settlement', 'begin_settlement'),
      typeArguments: [this.coinType],
      arguments: [
        tx.object(args.providerCapId),
        tx.object(args.campaignId),
        u8vec(tx, args.usageStatsHash),
        u8vec(tx, args.reportBlobId),
      ],
    });
    for (const dsId of args.orderedDatasetIds) {
      tx.moveCall({
        target: this.target('settlement', 'pay_dataset'),
        typeArguments: [this.coinType],
        arguments: [settlement, tx.object(args.campaignId), tx.object(dsId)],
      });
    }
    tx.moveCall({
      target: this.target('settlement', 'finish_settlement'),
      typeArguments: [this.coinType],
      arguments: [settlement, tx.object(args.campaignId), tx.object(SUI_CLOCK_OBJECT_ID)],
    });
    return tx;
  }

  // === acl ===

  grantProviderCap(tx: Transaction, args: { publisherCapId: string; provider: string }): Transaction {
    tx.moveCall({
      target: this.target('acl', 'grant_and_transfer_provider_cap'),
      arguments: [tx.object(args.publisherCapId), tx.pure.address(args.provider)],
    });
    return tx;
  }
}

// === Object field parsers (from SuiObjectResponse content.fields) ===

const toBytes = (v: unknown): Uint8Array =>
  v instanceof Uint8Array ? v : new Uint8Array((v as number[]) ?? []);

export function parseDataset(fields: Record<string, any>): Dataset {
  return {
    id: fields.id?.id ?? fields.id,
    owner: fields.owner,
    blobId: toBytes(fields.blob_id),
    sealInnerId: toBytes(fields.seal_inner_id),
    schemaUri: toBytes(fields.schema_uri),
    name: fields.name,
    pricing: {
      model: Number(fields.pricing.fields.model) as PricingModel,
      unitPrice: BigInt(fields.pricing.fields.unit_price),
    },
    revShareBps: Number(fields.rev_share_bps),
    listed: Boolean(fields.listed),
    version: BigInt(fields.version),
  };
}

export function parseCampaign(fields: Record<string, any>): Campaign {
  return {
    id: fields.id?.id ?? fields.id,
    buyer: fields.buyer,
    modelProvider: fields.model_provider,
    datasetIds: fields.dataset_ids ?? [],
    revWeights: (fields.rev_weights ?? []).map(Number),
    weightTotal: BigInt(fields.weight_total),
    priceFloor: BigInt(fields.price_floor),
    // Balance<T> serialises as its u64 value.
    budget: BigInt(fields.budget),
    status: Number(fields.status) as CampaignStatus,
    createdAtMs: BigInt(fields.created_at_ms),
  };
}

export function parseAccessTicket(fields: Record<string, any>): AccessTicket {
  return {
    id: fields.id?.id ?? fields.id,
    campaignId: fields.campaign_id,
    datasetIds: fields.dataset_ids ?? [],
    provider: fields.provider,
    expiryMs: BigInt(fields.expiry_ms),
  };
}

export function parseUsageRecord(fields: Record<string, any>): UsageRecord {
  return {
    id: fields.id?.id ?? fields.id,
    campaignId: fields.campaign_id,
    datasetIds: fields.dataset_ids ?? [],
    usageStatsHash: toBytes(fields.usage_stats_hash),
    reportBlobId: toBytes(fields.report_blob_id),
    settledAmounts: (fields.settled_amounts ?? []).map((x: string) => BigInt(x)),
    settledAtMs: BigInt(fields.settled_at_ms),
  };
}
