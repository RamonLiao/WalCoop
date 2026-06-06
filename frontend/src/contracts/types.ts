// Generated from the `data_coop` Move package ABI.
// u64/u128 -> bigint (avoid JS number precision loss). vector<u8> -> Uint8Array.
// ID/UID/address -> string (0x-prefixed hex).

/** Pricing models — mirrors dataset::PRICE_* constants. */
export enum PricingModel {
  PerUse = 0,
  PerTrainingHour = 1,
  PerVolume = 2,
}

/** Campaign lifecycle — mirrors campaign::STATUS_* constants. */
export enum CampaignStatus {
  Pending = 0,
  Active = 1,
  Settled = 2,
  Cancelled = 3,
}

export interface Pricing {
  model: PricingModel;
  unitPrice: bigint;
}

/** Shared object. `0x...::dataset::Dataset`. */
export interface Dataset {
  id: string;
  owner: string;
  /** Walrus blob id of the Seal-encrypted dataset. */
  blobId: Uint8Array;
  /** Seal inner identity (= this dataset's object-id bytes by convention). */
  sealInnerId: Uint8Array;
  /** Walrus blob id of the plaintext schema/manifest. */
  schemaUri: Uint8Array;
  name: string;
  pricing: Pricing;
  revShareBps: number;
  listed: boolean;
  version: bigint;
}

/** Shared object. `0x...::campaign::Campaign<T>`. */
export interface Campaign {
  id: string;
  buyer: string;
  modelProvider: string;
  datasetIds: string[];
  revWeights: number[];
  weightTotal: bigint;
  /** Minimum budget required before an AccessTicket is issued (Σ unit_price). */
  priceFloor: bigint;
  /** Current locked balance value. */
  budget: bigint;
  status: CampaignStatus;
  createdAtMs: bigint;
}

/** Owned object held by the model provider. `0x...::campaign::AccessTicket`. */
export interface AccessTicket {
  id: string;
  campaignId: string;
  datasetIds: string[];
  provider: string;
  expiryMs: bigint;
}

/** Immutable (frozen) audit record. `0x...::settlement::UsageRecord`. */
export interface UsageRecord {
  id: string;
  campaignId: string;
  datasetIds: string[];
  usageStatsHash: Uint8Array;
  reportBlobId: Uint8Array;
  /** Per-dataset payout, aligned with `datasetIds`. */
  settledAmounts: bigint[];
  settledAtMs: bigint;
}

export interface PublisherCap {
  id: string;
}

export interface ProviderCap {
  id: string;
  provider: string;
}

// === Events ===

export interface DatasetRegisteredEvent {
  datasetId: string;
  owner: string;
  version: bigint;
}

export interface DatasetUpdatedEvent {
  datasetId: string;
  version: bigint;
}

export interface DatasetListingChangedEvent {
  datasetId: string;
  listed: boolean;
}

export interface CampaignCreatedEvent {
  campaignId: string;
  buyer: string;
  nDatasets: bigint;
  weightTotal: bigint;
}

export interface CampaignFundedEvent {
  campaignId: string;
  amount: bigint;
}

export interface AccessTicketIssuedEvent {
  campaignId: string;
  provider: string;
  expiryMs: bigint;
}

export interface CampaignCancelledEvent {
  campaignId: string;
  refunded: bigint;
}

export interface CampaignSettledEvent {
  campaignId: string;
  reportBlobId: Uint8Array;
  totalPaid: bigint;
  dustRefunded: bigint;
}

export interface ProviderCapGrantedEvent {
  capId: string;
  provider: string;
}

/** Fully-qualified event type tags (suffix appended to packageId). */
export const EVENT_TYPES = {
  DatasetRegistered: 'dataset::DatasetRegistered',
  DatasetUpdated: 'dataset::DatasetUpdated',
  DatasetListingChanged: 'dataset::DatasetListingChanged',
  CampaignCreated: 'campaign::CampaignCreated',
  CampaignFunded: 'campaign::CampaignFunded',
  AccessTicketIssued: 'campaign::AccessTicketIssued',
  CampaignCancelled: 'campaign::CampaignCancelled',
  CampaignSettled: 'settlement::CampaignSettled',
  ProviderCapGranted: 'acl::ProviderCapGranted',
} as const;
