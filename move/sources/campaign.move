/// Campaigns: a buyer locks budget against a basket of datasets and authorises
/// a model provider to use them. Revenue-share weights are snapshotted ON-CHAIN
/// from each dataset's declared `rev_share_bps` at build time, so the buyer
/// cannot hand-craft weights to shortchange a provider, and a dataset owner
/// cannot retroactively change their cut mid-campaign.
///
/// Lifecycle: Pending --fund--> Active --settle--> Settled
///                  \--cancel--> Cancelled   (Active can also cancel)
module data_coop::campaign;

use data_coop::dataset::{Self, Dataset};
use sui::balance::{Self, Balance};
use sui::clock::Clock;
use sui::coin::{Self, Coin};
use sui::event;

// === Errors ===

#[error]
const ENotBuyer: vector<u8> = b"caller is not the campaign buyer";
#[error]
const ECampaignNotActive: vector<u8> = b"campaign is not in Active state";
#[error]
const EAlreadyFinalized: vector<u8> = b"campaign already settled or cancelled";
#[error]
const EEmptyBasket: vector<u8> = b"campaign must reference at least one dataset";
#[error]
const EDatasetNotListed: vector<u8> = b"dataset is not listed";
#[error]
const EExpiryInPast: vector<u8> = b"ticket expiry must be in the future";
#[error]
const EUnderfunded: vector<u8> = b"budget below the basket price floor; access denied";

// === Status ===

const STATUS_PENDING: u8 = 0;
const STATUS_ACTIVE: u8 = 1;
const STATUS_SETTLED: u8 = 2;
const STATUS_CANCELLED: u8 = 3;

// === Structs ===

/// Shared so the provider can reference it during settlement and anyone can
/// inspect basket/status. Budget is held internally as `Balance<T>` (a shared
/// object cannot own a `Coin`).
public struct Campaign<phantom T> has key {
    id: UID,
    buyer: address,
    model_provider: address,
    dataset_ids: vector<ID>,
    /// Per-dataset weight snapshot (aligned with `dataset_ids`), copied from
    /// each `Dataset.rev_share_bps` at build time.
    rev_weights: vector<u16>,
    /// Sum of `rev_weights`; settlement normalises payouts against this.
    weight_total: u64,
    /// Minimum budget required before access is granted — sum of each dataset's
    /// `unit_price`. Ties decryption rights to adequate payment so a buyer
    /// cannot underfund and still extract data value.
    price_floor: u64,
    budget: Balance<T>,
    status: u8,
    created_at_ms: u64,
}

/// Hot-potato builder: forces datasets to be added via `add_dataset` (which
/// reads the on-chain weight) before the campaign can be shared. Has no
/// abilities, so it MUST be consumed by `share_campaign` in the same PTB.
public struct CampaignBuilder<phantom T> {
    buyer: address,
    model_provider: address,
    dataset_ids: vector<ID>,
    rev_weights: vector<u16>,
    weight_total: u64,
    price_floor: u64,
    created_at_ms: u64,
}

/// Owned authorisation handed to the model provider. Consumed/read by
/// `access::seal_approve` to gate Walrus decryption.
public struct AccessTicket has key {
    id: UID,
    campaign_id: ID,
    dataset_ids: vector<ID>,
    provider: address,
    expiry_ms: u64,
}

// === Events ===

public struct CampaignCreated has copy, drop {
    campaign_id: ID,
    buyer: address,
    n_datasets: u64,
    weight_total: u64,
}

public struct CampaignFunded has copy, drop {
    campaign_id: ID,
    amount: u64,
}

public struct AccessTicketIssued has copy, drop {
    campaign_id: ID,
    provider: address,
    expiry_ms: u64,
}

public struct CampaignCancelled has copy, drop {
    campaign_id: ID,
    refunded: u64,
}

// === Build flow ===

/// Start building a campaign. The caller becomes the buyer. Datasets are added
/// with `add_dataset`, then `share_campaign` finalises it as `Pending`.
public fun new_campaign<T>(
    model_provider: address,
    clock: &Clock,
    ctx: &TxContext,
): CampaignBuilder<T> {
    CampaignBuilder<T> {
        buyer: ctx.sender(),
        model_provider,
        dataset_ids: vector[],
        rev_weights: vector[],
        weight_total: 0,
        price_floor: 0,
        created_at_ms: clock.timestamp_ms(),
    }
}

/// Add a dataset to the basket, snapshotting its declared revenue weight on
/// chain. Aborts if the dataset is unlisted.
public fun add_dataset<T>(builder: &mut CampaignBuilder<T>, ds: &Dataset) {
    assert!(dataset::is_listed(ds), EDatasetNotListed);
    let bps = dataset::rev_share_bps(ds);
    builder.dataset_ids.push_back(object::id(ds));
    builder.rev_weights.push_back(bps);
    builder.weight_total = builder.weight_total + (bps as u64);
    builder.price_floor = builder.price_floor + dataset::unit_price(dataset::pricing(ds));
}

/// Finalise the builder into a shared `Campaign` in `Pending` state with zero
/// budget. Aborts on an empty basket.
public fun share_campaign<T>(builder: CampaignBuilder<T>, ctx: &mut TxContext) {
    let CampaignBuilder {
        buyer,
        model_provider,
        dataset_ids,
        rev_weights,
        weight_total,
        price_floor,
        created_at_ms,
    } = builder;
    assert!(!dataset_ids.is_empty(), EEmptyBasket);

    let c = Campaign<T> {
        id: object::new(ctx),
        buyer,
        model_provider,
        dataset_ids,
        rev_weights,
        weight_total,
        price_floor,
        budget: balance::zero<T>(),
        status: STATUS_PENDING,
        created_at_ms,
    };
    event::emit(CampaignCreated {
        campaign_id: object::id(&c),
        buyer,
        n_datasets: c.dataset_ids.length(),
        weight_total,
    });
    transfer::share_object(c);
}

// === Funding ===

/// Buyer deposits budget, moving the campaign to `Active`. Can be called while
/// `Pending` (initial funding) or `Active` (top-up).
public fun fund_campaign<T>(c: &mut Campaign<T>, payment: Coin<T>, ctx: &TxContext) {
    assert!(c.buyer == ctx.sender(), ENotBuyer);
    assert!(c.status == STATUS_PENDING || c.status == STATUS_ACTIVE, EAlreadyFinalized);
    let amount = payment.value();
    c.budget.join(payment.into_balance());
    c.status = STATUS_ACTIVE;
    event::emit(CampaignFunded { campaign_id: object::id(c), amount });
}

// === Access tickets ===

/// Buyer issues a time-boxed access ticket to the model provider. Requires the
/// campaign to be funded (`Active`). The ticket scopes exactly the campaign's
/// datasets and is transferred to the provider.
public fun issue_access_ticket<T>(
    c: &Campaign<T>,
    expiry_ms: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(c.buyer == ctx.sender(), ENotBuyer);
    assert!(c.status == STATUS_ACTIVE, ECampaignNotActive);
    // Access is gated on adequate payment: the locked budget must cover the
    // basket's price floor, or no decryption ticket is issued.
    assert!(c.budget.value() >= c.price_floor, EUnderfunded);
    assert!(expiry_ms > clock.timestamp_ms(), EExpiryInPast);

    let ticket = AccessTicket {
        id: object::new(ctx),
        campaign_id: object::id(c),
        dataset_ids: c.dataset_ids,
        provider: c.model_provider,
        expiry_ms,
    };
    event::emit(AccessTicketIssued {
        campaign_id: object::id(c),
        provider: c.model_provider,
        expiry_ms,
    });
    transfer::transfer(ticket, c.model_provider);
}

// === Cancellation (DoS / stuck-budget protection) ===

/// Buyer reclaims the full remaining budget if the campaign was never settled.
/// Moves status to `Cancelled`. The campaign object stays shared (as an
/// auditable record) with an empty balance.
public fun cancel_campaign<T>(c: &mut Campaign<T>, ctx: &mut TxContext) {
    assert!(c.buyer == ctx.sender(), ENotBuyer);
    assert!(
        c.status != STATUS_SETTLED && c.status != STATUS_CANCELLED,
        EAlreadyFinalized,
    );
    let amount = c.budget.value();
    let refund = coin::from_balance(c.budget.withdraw_all(), ctx);
    c.status = STATUS_CANCELLED;
    event::emit(CampaignCancelled { campaign_id: object::id(c), refunded: amount });
    transfer::public_transfer(refund, c.buyer);
}

// === Package-internal hooks for settlement ===

/// Mutable access to the budget balance — settlement withdraws payouts here.
public(package) fun budget_mut<T>(c: &mut Campaign<T>): &mut Balance<T> {
    &mut c.budget
}

/// Mark settled. Caller (settlement module) is responsible for the cap check.
public(package) fun mark_settled<T>(c: &mut Campaign<T>) {
    c.status = STATUS_SETTLED;
}

public(package) fun assert_active<T>(c: &Campaign<T>) {
    assert!(c.status == STATUS_ACTIVE, ECampaignNotActive);
}

// === Read accessors ===

public fun buyer<T>(c: &Campaign<T>): address { c.buyer }

public fun model_provider<T>(c: &Campaign<T>): address { c.model_provider }

public fun dataset_ids<T>(c: &Campaign<T>): vector<ID> { c.dataset_ids }

public fun rev_weights<T>(c: &Campaign<T>): vector<u16> { c.rev_weights }

public fun weight_total<T>(c: &Campaign<T>): u64 { c.weight_total }

public fun price_floor<T>(c: &Campaign<T>): u64 { c.price_floor }

public fun budget_value<T>(c: &Campaign<T>): u64 { c.budget.value() }

public fun status<T>(c: &Campaign<T>): u8 { c.status }

// AccessTicket accessors (read by `access` module).
public fun ticket_campaign_id(t: &AccessTicket): ID { t.campaign_id }

public fun ticket_provider(t: &AccessTicket): address { t.provider }

public fun ticket_expiry_ms(t: &AccessTicket): u64 { t.expiry_ms }

public fun ticket_dataset_ids(t: &AccessTicket): &vector<ID> { &t.dataset_ids }

/// Whether `dataset_id` is within this ticket's authorised scope.
public fun ticket_covers(t: &AccessTicket, dataset_id: ID): bool {
    t.dataset_ids.contains(&dataset_id)
}

// Status constants for other modules / tests.
public fun status_pending(): u8 { STATUS_PENDING }
public fun status_active(): u8 { STATUS_ACTIVE }
public fun status_settled(): u8 { STATUS_SETTLED }
public fun status_cancelled(): u8 { STATUS_CANCELLED }

#[test_only]
public fun new_ticket_for_testing(
    campaign_id: ID,
    dataset_ids: vector<ID>,
    provider: address,
    expiry_ms: u64,
    ctx: &mut TxContext,
): AccessTicket {
    AccessTicket {
        id: object::new(ctx),
        campaign_id,
        dataset_ids,
        provider,
        expiry_ms,
    }
}

#[test_only]
public fun destroy_ticket_for_testing(t: AccessTicket) {
    let AccessTicket { id, campaign_id: _, dataset_ids: _, provider: _, expiry_ms: _ } = t;
    id.delete();
}
