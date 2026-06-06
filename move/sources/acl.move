/// Access-control capabilities for the Data Coop package.
///
/// Authority root: at publish time the deployer receives a single
/// `PublisherCap`. That cap gates the minting of `ProviderCap`s, which in
/// turn authorise `settlement::settle_campaign`. No public path mints a
/// capability without holding one first — this prevents anyone from forging
/// settlement authority.
module data_coop::acl;

use sui::event;

/// Platform-level authority, minted once to the deployer in `init`.
/// Holding it grants the right to mint `ProviderCap`s.
public struct PublisherCap has key, store {
    id: UID,
}

/// Authorises a model provider to call `settle_campaign`.
/// Bound to a specific provider address so a leaked cap cannot redirect funds
/// to an arbitrary settler without also matching on-chain checks.
public struct ProviderCap has key, store {
    id: UID,
    provider: address,
}

/// Emitted when a new provider capability is granted.
public struct ProviderCapGranted has copy, drop {
    cap_id: ID,
    provider: address,
}

/// Run once on publish: hand the sole `PublisherCap` to the deployer.
fun init(ctx: &mut TxContext) {
    let cap = PublisherCap { id: object::new(ctx) };
    transfer::public_transfer(cap, ctx.sender());
}

/// Mint a `ProviderCap` for `provider`. Gated by `PublisherCap`, so only the
/// platform authority can create settlement-capable capabilities.
public fun grant_provider_cap(
    _: &PublisherCap,
    provider: address,
    ctx: &mut TxContext,
): ProviderCap {
    let cap = ProviderCap { id: object::new(ctx), provider };
    event::emit(ProviderCapGranted { cap_id: object::id(&cap), provider });
    cap
}

/// Convenience: mint and transfer a `ProviderCap` straight to `provider`.
public fun grant_and_transfer_provider_cap(
    pub: &PublisherCap,
    provider: address,
    ctx: &mut TxContext,
) {
    let cap = grant_provider_cap(pub, provider, ctx);
    transfer::public_transfer(cap, provider);
}

/// The address this `ProviderCap` is bound to. Used by `settlement` to assert
/// the cap holder matches the campaign's designated `model_provider`.
public fun provider(cap: &ProviderCap): address {
    cap.provider
}

/// Permanently destroy a `ProviderCap` (e.g. revoking a provider).
public fun revoke_provider_cap(cap: ProviderCap) {
    let ProviderCap { id, .. } = cap;
    id.delete();
}

#[test_only]
/// Expose `init` for tests.
public fun init_for_testing(ctx: &mut TxContext) {
    init(ctx);
}

#[test_only]
public fun new_publisher_cap_for_testing(ctx: &mut TxContext): PublisherCap {
    PublisherCap { id: object::new(ctx) }
}
