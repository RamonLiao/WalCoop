#[test_only]
/// Adversarial tests. Each documents an attack the contract must defend.
module data_coop::red_team_tests;

use data_coop::acl::{Self, ProviderCap};
use data_coop::campaign::{Self, Campaign};
use data_coop::dataset::{Self, Dataset};
use data_coop::settlement;
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const BUYER: address = @0xB1;
const PROVIDER: address = @0xB2;
const R1: address = @0xC1;
const R2: address = @0xC2;

fun grant_provider(sc: &mut ts::Scenario, who: address) {
    sc.next_tx(ADMIN);
    let pub = acl::new_publisher_cap_for_testing(sc.ctx());
    acl::grant_and_transfer_provider_cap(&pub, who, sc.ctx());
    transfer::public_transfer(pub, ADMIN);
}

// Two datasets, unit_price 100 each (register_for_testing default) → price_floor 200.
fun seed(sc: &mut ts::Scenario): (ID, ID) {
    sc.next_tx(R1);
    let id1 = dataset::register_for_testing(6000, sc.ctx());
    sc.next_tx(R2);
    let id2 = dataset::register_for_testing(4000, sc.ctx());
    (id1, id2)
}

fun build(sc: &mut ts::Scenario, clk: &clock::Clock, id1: ID, id2: ID) {
    sc.next_tx(BUYER);
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let ds2 = sc.take_shared_by_id<Dataset>(id2);
    let mut b = campaign::new_campaign<SUI>(PROVIDER, clk, sc.ctx());
    campaign::add_dataset(&mut b, &ds1);
    campaign::add_dataset(&mut b, &ds2);
    campaign::share_campaign(b, sc.ctx());
    ts::return_shared(ds1);
    ts::return_shared(ds2);
}

/// ATTACK (economic): buyer funds a trivial amount, then claims an AccessTicket
/// granting Seal decryption to ALL datasets — extracting data value while data
/// owners are paid ~nothing. Must be DEFENDED by a price floor.
#[test, expected_failure(abort_code = campaign::EUnderfunded)]
fun underfund_then_grab_access() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed(&mut sc);
    build(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<Campaign<SUI>>();
    // Fund only 1 mist against a 200 price floor.
    campaign::fund_campaign(&mut c, coin::mint_for_testing<SUI>(1, sc.ctx()), sc.ctx());
    campaign::issue_access_ticket(&c, 10_000, &clk, sc.ctx()); // aborts: underfunded
    abort
}

/// Adequate funding (>= price floor) issues the ticket normally.
#[test]
fun adequately_funded_issues_ticket() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed(&mut sc);
    build(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<Campaign<SUI>>();
    campaign::fund_campaign(&mut c, coin::mint_for_testing<SUI>(200, sc.ctx()), sc.ctx());
    campaign::issue_access_ticket(&c, 10_000, &clk, sc.ctx());
    ts::return_shared(c);

    sc.next_tx(PROVIDER);
    let t = sc.take_from_sender<campaign::AccessTicket>();
    campaign::destroy_ticket_for_testing(t);
    clock::destroy_for_testing(clk);
    sc.end();
}

/// ATTACK (economic/state): settle a never-funded (Pending) campaign.
#[test, expected_failure(abort_code = campaign::ECampaignNotActive)]
fun settle_pending_campaign() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build(&mut sc, &clk, id1, id2); // never funded → Pending

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let _s = settlement::begin_settlement(&cap, &mut c, b"h", b"r"); // aborts
    abort
}

/// ATTACK (economic/state): settle a cancelled campaign to double-spend.
#[test, expected_failure(abort_code = campaign::ECampaignNotActive)]
fun settle_after_cancel() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<Campaign<SUI>>();
    campaign::fund_campaign(&mut c, coin::mint_for_testing<SUI>(1_000, sc.ctx()), sc.ctx());
    campaign::cancel_campaign(&mut c, sc.ctx()); // refunded, Cancelled
    ts::return_shared(c);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let _s = settlement::begin_settlement(&cap, &mut c, b"h", b"r"); // aborts: not Active
    abort
}

/// ATTACK (integer): huge budget must not overflow mul_div during payout.
#[test]
fun max_budget_no_overflow() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build(&mut sc, &clk, id1, id2);

    let big: u64 = 18_000_000_000_000_000_000; // ~1.8e19, near u64 max
    sc.next_tx(BUYER);
    let mut c = sc.take_shared<Campaign<SUI>>();
    campaign::fund_campaign(&mut c, coin::mint_for_testing<SUI>(big, sc.ctx()), sc.ctx());
    ts::return_shared(c);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let ds2 = sc.take_shared_by_id<Dataset>(id2);
    let mut s = settlement::begin_settlement(&cap, &mut c, b"h", b"r");
    settlement::pay_dataset(&mut s, &mut c, &ds1, sc.ctx());
    settlement::pay_dataset(&mut s, &mut c, &ds2, sc.ctx());
    settlement::finish_settlement(s, &mut c, &clk, sc.ctx());
    assert!(campaign::budget_value(&c) == 0, 0); // 60/40 split, no dust at these weights
    ts::return_shared(ds1);
    ts::return_shared(ds2);
    ts::return_shared(c);
    sc.return_to_sender(cap);

    sc.next_tx(R1);
    let p1 = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(p1.value() == 10_800_000_000_000_000_000, 1); // big * 0.6
    coin::burn_for_testing(p1);
    clock::destroy_for_testing(clk);
    sc.end();
}
