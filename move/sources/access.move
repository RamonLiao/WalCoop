/// Seal access-control policy for Walrus decryption.
///
/// Each dataset is encrypted under the Seal identity `[package_id][inner_id]`
/// where `inner_id` is the dataset's own object-ID bytes. To decrypt, a model
/// provider's client builds a transaction calling `seal_approve`; the Seal key
/// servers only release their key shares if this evaluation succeeds. The
/// platform backend therefore CANNOT hand out decryption keys on its own — the
/// on-chain ticket is the sole gate.
module data_coop::access;

use data_coop::campaign::{Self, AccessTicket};
use sui::clock::Clock;

// === Errors ===

#[error]
const EWrongProvider: vector<u8> = b"caller is not the ticket's provider";
#[error]
const EExpired: vector<u8> = b"access ticket has expired";
#[error]
const ENoAccess: vector<u8> = b"dataset not within ticket scope";

/// Seal policy entry. `id` is the inner identity = the target dataset's
/// object-ID bytes. Aborting denies key release.
///
/// Checks, in order:
///   1. the caller is exactly the provider named on the ticket,
///   2. the ticket has not expired,
///   3. the requested dataset id is within the ticket's authorised basket.
entry fun seal_approve(
    id: vector<u8>,
    ticket: &AccessTicket,
    clock: &Clock,
    ctx: &TxContext,
) {
    assert!(ctx.sender() == campaign::ticket_provider(ticket), EWrongProvider);
    assert!(clock.timestamp_ms() < campaign::ticket_expiry_ms(ticket), EExpired);
    let dataset_id = object::id_from_bytes(id);
    assert!(campaign::ticket_covers(ticket, dataset_id), ENoAccess);
}

#[test_only]
/// Test shim: `seal_approve` is private to Seal's call convention, so expose a
/// thin wrapper for unit tests.
public fun seal_approve_for_testing(
    id: vector<u8>,
    ticket: &AccessTicket,
    clock: &Clock,
    ctx: &TxContext,
) {
    seal_approve(id, ticket, clock, ctx)
}
