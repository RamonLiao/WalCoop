/// Settlement: a `ProviderCap` holder splits a campaign's locked budget across
/// its datasets by the on-chain weight snapshot, then mints an immutable
/// `UsageRecord`. Payout fairness is enforced by the type system: a hot-potato
/// `Settlement` forces every dataset to be paid (in the campaign's recorded
/// order) before `finish_settlement` can mark the campaign settled.
///
/// Flow (single PTB):
///   begin_settlement -> pay_dataset (x N, in order) -> finish_settlement
module data_coop::settlement;

use data_coop::acl::{Self, ProviderCap};
use data_coop::campaign::{Self, Campaign};
use data_coop::dataset::{Self, Dataset};
use std::u64;
use sui::clock::Clock;
use sui::coin;
use sui::event;

// === Errors ===

#[error]
const EProviderMismatch: vector<u8> = b"provider cap does not match campaign model_provider";
#[error]
const EDatasetOrderMismatch: vector<u8> = b"dataset does not match campaign basket order";
#[error]
const EIncompleteSettlement: vector<u8> = b"not all datasets have been paid";

// === Structs ===

/// Immutable settlement receipt, owned by the model provider.
public struct UsageRecord has key, store {
    id: UID,
    campaign_id: ID,
    dataset_ids: vector<ID>,
    /// Hash of the training report contents — providers can recompute against
    /// the Walrus blob to verify the platform did not alter it.
    usage_stats_hash: vector<u8>,
    /// Walrus blob id of the training report.
    report_blob_id: vector<u8>,
    /// Amount paid per dataset, aligned with `dataset_ids`.
    settled_amounts: vector<u64>,
    settled_at_ms: u64,
}

/// Hot potato (no abilities): forces the full pay -> finish sequence in one PTB.
public struct Settlement {
    campaign_id: ID,
    /// Budget snapshot at begin, used as a fixed denominator base for payouts.
    budget_total: u64,
    weight_total: u64,
    n: u64,
    next_index: u64,
    usage_stats_hash: vector<u8>,
    report_blob_id: vector<u8>,
    settled_amounts: vector<u64>,
}

// === Events ===

public struct CampaignSettled has copy, drop {
    campaign_id: ID,
    report_blob_id: vector<u8>,
    total_paid: u64,
    dust_refunded: u64,
}

// === Flow ===

/// Begin settling an Active campaign. Requires a `ProviderCap` bound to the
/// campaign's designated model provider.
public fun begin_settlement<T>(
    cap: &ProviderCap,
    c: &mut Campaign<T>,
    usage_stats_hash: vector<u8>,
    report_blob_id: vector<u8>,
): Settlement {
    assert!(acl::provider(cap) == campaign::model_provider(c), EProviderMismatch);
    campaign::assert_active(c);
    Settlement {
        campaign_id: object::id(c),
        budget_total: campaign::budget_value(c),
        weight_total: campaign::weight_total(c),
        n: campaign::dataset_ids(c).length(),
        next_index: 0,
        usage_stats_hash,
        report_blob_id,
        settled_amounts: vector[],
    }
}

/// Pay the next dataset in the campaign's recorded order. `ds` MUST be the
/// dataset at the current index; its owner receives `budget_total * weight_i /
/// weight_total` (overflow-safe). The owner address is read from the live
/// `Dataset`, so payouts cannot be redirected by passing a mismatched object.
public fun pay_dataset<T>(
    s: &mut Settlement,
    c: &mut Campaign<T>,
    ds: &Dataset,
    ctx: &mut TxContext,
) {
    let i = s.next_index;
    let ids = campaign::dataset_ids(c);
    assert!(object::id(ds) == ids[i], EDatasetOrderMismatch);

    let weights = campaign::rev_weights(c);
    let weight_i = (weights[i] as u64);
    let amount = u64::mul_div(s.budget_total, weight_i, s.weight_total);

    if (amount > 0) {
        let part = campaign::budget_mut(c).split(amount);
        transfer::public_transfer(coin::from_balance(part, ctx), dataset::owner(ds));
    };
    s.settled_amounts.push_back(amount);
    s.next_index = i + 1;
}

/// Finalise: all datasets must be paid. Any rounding dust left in the budget is
/// refunded to the buyer. Marks the campaign Settled and mints the
/// `UsageRecord` to the provider.
public fun finish_settlement<T>(
    s: Settlement,
    c: &mut Campaign<T>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let Settlement {
        campaign_id,
        n,
        next_index,
        usage_stats_hash,
        report_blob_id,
        settled_amounts,
        ..
    } = s;
    assert!(next_index == n, EIncompleteSettlement);

    // Refund rounding dust to the buyer.
    let dust = campaign::budget_value(c);
    if (dust > 0) {
        let part = campaign::budget_mut(c).withdraw_all();
        transfer::public_transfer(coin::from_balance(part, ctx), campaign::buyer(c));
    };

    campaign::mark_settled(c);

    let total_paid = sum(&settled_amounts);
    event::emit(CampaignSettled {
        campaign_id,
        report_blob_id,
        total_paid,
        dust_refunded: dust,
    });

    let record = UsageRecord {
        id: object::new(ctx),
        campaign_id,
        dataset_ids: campaign::dataset_ids(c),
        usage_stats_hash,
        report_blob_id,
        settled_amounts,
        settled_at_ms: clock.timestamp_ms(),
    };
    // Freeze as an immutable, publicly-readable audit record: data providers
    // (and anyone) can inspect the per-dataset payout breakdown, satisfying the
    // "verifiable revenue share" guarantee.
    transfer::freeze_object(record);
}

// === Internal ===

fun sum(v: &vector<u64>): u64 {
    let mut total = 0;
    v.do_ref!(|x| total = total + *x);
    total
}

// === Read accessors ===

public fun record_campaign_id(r: &UsageRecord): ID { r.campaign_id }

public fun record_report_blob_id(r: &UsageRecord): vector<u8> { r.report_blob_id }

public fun record_settled_amounts(r: &UsageRecord): vector<u64> { r.settled_amounts }

public fun record_usage_stats_hash(r: &UsageRecord): vector<u8> { r.usage_stats_hash }
