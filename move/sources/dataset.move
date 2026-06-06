/// Dataset registry. A `Dataset` is a shared object representing ownership of
/// an encrypted blob stored on Walrus. The contract never sees the plaintext —
/// it only tracks who owns what, the Walrus pointer, the Seal identity used to
/// gate decryption, pricing, and the revenue-share weight.
module data_coop::dataset;

use std::string::String;
use sui::event;

// === Errors ===

#[error]
const ENotOwner: vector<u8> = b"caller is not the dataset owner";
#[error]
const EInvalidRevShare: vector<u8> = b"rev_share_bps must be in 1..=10000";
#[error]
const EInvalidPricingModel: vector<u8> = b"unknown pricing model";

// === Constants ===

const BPS_DENOM: u16 = 10_000;

/// Pricing models (`Pricing.model`).
const PRICE_PER_USE: u8 = 0;
const PRICE_PER_TRAINING_HOUR: u8 = 1;
const PRICE_PER_VOLUME: u8 = 2;

// === Structs ===

/// How a dataset charges. `unit_price` is denominated in the smallest unit of
/// the campaign's payment coin.
public struct Pricing has store, copy, drop {
    model: u8,
    unit_price: u64,
}

/// Shared so any buyer can reference it when composing a campaign. Writes
/// (list/unlist, meta update) are owner-gated and low-frequency.
public struct Dataset has key {
    id: UID,
    owner: address,
    /// Walrus blob id of the Seal-encrypted dataset.
    blob_id: vector<u8>,
    /// Seal inner identity; full identity is `[package_id][seal_inner_id]`.
    seal_inner_id: vector<u8>,
    /// Walrus blob id of the plaintext schema/manifest.
    schema_uri: vector<u8>,
    /// Human-readable label for the marketplace.
    name: String,
    pricing: Pricing,
    /// Revenue-share weight in basis points when combined with other datasets.
    rev_share_bps: u16,
    listed: bool,
    /// Bumped on every blob update so consumers can pin a version.
    version: u64,
}

// === Events ===

public struct DatasetRegistered has copy, drop {
    dataset_id: ID,
    owner: address,
    version: u64,
}

public struct DatasetUpdated has copy, drop {
    dataset_id: ID,
    version: u64,
}

public struct DatasetListingChanged has copy, drop {
    dataset_id: ID,
    listed: bool,
}

// === Constructors ===

/// Build a validated `Pricing`. Aborts on an unknown model.
public fun new_pricing(model: u8, unit_price: u64): Pricing {
    assert!(
        model == PRICE_PER_USE
            || model == PRICE_PER_TRAINING_HOUR
            || model == PRICE_PER_VOLUME,
        EInvalidPricingModel,
    );
    Pricing { model, unit_price }
}

/// Register a new dataset and share it. The caller becomes the owner and
/// revenue recipient. `rev_share_bps` must be within `1..=10000`.
public fun register_dataset(
    blob_id: vector<u8>,
    seal_inner_id: vector<u8>,
    schema_uri: vector<u8>,
    name: String,
    pricing: Pricing,
    rev_share_bps: u16,
    ctx: &mut TxContext,
) {
    assert!(rev_share_bps >= 1 && rev_share_bps <= BPS_DENOM, EInvalidRevShare);
    let ds = Dataset {
        id: object::new(ctx),
        owner: ctx.sender(),
        blob_id,
        seal_inner_id,
        schema_uri,
        name,
        pricing,
        rev_share_bps,
        listed: true,
        version: 1,
    };
    event::emit(DatasetRegistered {
        dataset_id: object::id(&ds),
        owner: ds.owner,
        version: ds.version,
    });
    transfer::share_object(ds);
}

// === Owner-gated mutations ===

/// Point the dataset at a new encrypted blob (e.g. a refreshed snapshot) and
/// bump the version. Owner only.
public fun update_blob(
    ds: &mut Dataset,
    new_blob_id: vector<u8>,
    new_seal_inner_id: vector<u8>,
    ctx: &TxContext,
) {
    assert_owner(ds, ctx);
    ds.blob_id = new_blob_id;
    ds.seal_inner_id = new_seal_inner_id;
    ds.version = ds.version + 1;
    event::emit(DatasetUpdated { dataset_id: object::id(ds), version: ds.version });
}

/// Update pricing. Owner only.
public fun update_pricing(ds: &mut Dataset, pricing: Pricing, ctx: &TxContext) {
    assert_owner(ds, ctx);
    ds.pricing = pricing;
}

/// List or unlist from the marketplace. Owner only.
public fun set_listed(ds: &mut Dataset, listed: bool, ctx: &TxContext) {
    assert_owner(ds, ctx);
    ds.listed = listed;
    event::emit(DatasetListingChanged { dataset_id: object::id(ds), listed });
}

// === Internal ===

fun assert_owner(ds: &Dataset, ctx: &TxContext) {
    assert!(ds.owner == ctx.sender(), ENotOwner);
}

// === Read accessors (used by campaign/settlement) ===

public fun owner(ds: &Dataset): address { ds.owner }

public fun blob_id(ds: &Dataset): vector<u8> { ds.blob_id }

public fun seal_inner_id(ds: &Dataset): vector<u8> { ds.seal_inner_id }

public fun rev_share_bps(ds: &Dataset): u16 { ds.rev_share_bps }

public fun pricing(ds: &Dataset): &Pricing { &ds.pricing }

public fun is_listed(ds: &Dataset): bool { ds.listed }

public fun version(ds: &Dataset): u64 { ds.version }

public fun pricing_model(p: &Pricing): u8 { p.model }

public fun unit_price(p: &Pricing): u64 { p.unit_price }

public fun bps_denom(): u16 { BPS_DENOM }

#[test_only]
public fun register_for_testing(
    rev_share_bps: u16,
    ctx: &mut TxContext,
): ID {
    let ds = Dataset {
        id: object::new(ctx),
        owner: ctx.sender(),
        blob_id: b"blob",
        seal_inner_id: b"inner",
        schema_uri: b"schema",
        name: b"test".to_string(),
        pricing: Pricing { model: PRICE_PER_USE, unit_price: 100 },
        rev_share_bps,
        listed: true,
        version: 1,
    };
    let id = object::id(&ds);
    transfer::share_object(ds);
    id
}
