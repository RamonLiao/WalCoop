#[test_only]
module data_coop::settlement_tests;

use data_coop::acl::{Self, ProviderCap};
use data_coop::campaign::{Self, Campaign};
use data_coop::dataset::{Self, Dataset};
use data_coop::settlement::{Self, UsageRecord};
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const BUYER: address = @0xB1;
const PROVIDER: address = @0xB2;
const R1: address = @0xC1; // owner of dataset 1 (6000 bps)
const R2: address = @0xC2; // owner of dataset 2 (4000 bps)

// Grant a ProviderCap bound to `who`, sent to `who`.
fun grant_provider(sc: &mut ts::Scenario, who: address) {
    sc.next_tx(ADMIN);
    let pub = acl::new_publisher_cap_for_testing(sc.ctx());
    acl::grant_and_transfer_provider_cap(&pub, who, sc.ctx());
    transfer::public_transfer(pub, ADMIN);
}

fun seed(sc: &mut ts::Scenario): (ID, ID) {
    sc.next_tx(R1);
    let id1 = dataset::register_for_testing(6000, sc.ctx());
    sc.next_tx(R2);
    let id2 = dataset::register_for_testing(4000, sc.ctx());
    (id1, id2)
}

fun build_and_fund(sc: &mut ts::Scenario, clk: &clock::Clock, id1: ID, id2: ID, amount: u64) {
    sc.next_tx(BUYER);
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let ds2 = sc.take_shared_by_id<Dataset>(id2);
    let mut b = campaign::new_campaign<SUI>(PROVIDER, clk, sc.ctx());
    campaign::add_dataset(&mut b, &ds1);
    campaign::add_dataset(&mut b, &ds2);
    campaign::share_campaign(b, sc.ctx());
    ts::return_shared(ds1);
    ts::return_shared(ds2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<Campaign<SUI>>();
    campaign::fund_campaign(&mut c, coin::mint_for_testing<SUI>(amount, sc.ctx()), sc.ctx());
    ts::return_shared(c);
}

#[test]
fun settles_proportionally_to_weights() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build_and_fund(&mut sc, &clk, id1, id2, 1_000);

    // Provider settles in one tx: begin -> pay ds1 -> pay ds2 -> finish.
    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let ds2 = sc.take_shared_by_id<Dataset>(id2);

    let mut s = settlement::begin_settlement(&cap, &mut c, b"statshash", b"reportblob");
    settlement::pay_dataset(&mut s, &mut c, &ds1, sc.ctx());
    settlement::pay_dataset(&mut s, &mut c, &ds2, sc.ctx());
    settlement::finish_settlement(s, &mut c, &clk, sc.ctx());

    assert!(campaign::status(&c) == campaign::status_settled(), 0);
    assert!(campaign::budget_value(&c) == 0, 1);

    ts::return_shared(ds1);
    ts::return_shared(ds2);
    ts::return_shared(c);
    sc.return_to_sender(cap);

    // R1 got 600 (6000bps), R2 got 400 (4000bps).
    sc.next_tx(R1);
    let p1 = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(p1.value() == 600, 2);
    coin::burn_for_testing(p1);

    sc.next_tx(R2);
    let p2 = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(p2.value() == 400, 3);
    coin::burn_for_testing(p2);

    // UsageRecord is frozen: anyone (incl. data providers) can read the
    // per-dataset payout breakdown.
    sc.next_tx(R1);
    let rec = sc.take_immutable<UsageRecord>();
    assert!(settlement::record_settled_amounts(&rec) == vector[600, 400], 4);
    assert!(settlement::record_report_blob_id(&rec) == b"reportblob", 5);
    ts::return_immutable(rec);

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
fun dust_refunds_to_buyer() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    // 1003: 601 + 401 = 1002 paid, dust 1 -> buyer.
    build_and_fund(&mut sc, &clk, id1, id2, 1_003);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let ds2 = sc.take_shared_by_id<Dataset>(id2);
    let mut s = settlement::begin_settlement(&cap, &mut c, b"h", b"r");
    settlement::pay_dataset(&mut s, &mut c, &ds1, sc.ctx());
    settlement::pay_dataset(&mut s, &mut c, &ds2, sc.ctx());
    settlement::finish_settlement(s, &mut c, &clk, sc.ctx());
    ts::return_shared(ds1);
    ts::return_shared(ds2);
    ts::return_shared(c);
    sc.return_to_sender(cap);

    sc.next_tx(BUYER);
    let dust = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(dust.value() == 1, 0);
    coin::burn_for_testing(dust);

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test, expected_failure(abort_code = settlement::EProviderMismatch)]
fun wrong_provider_cap_rejected() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, R1); // cap bound to R1, not PROVIDER
    let (id1, id2) = seed(&mut sc);
    build_and_fund(&mut sc, &clk, id1, id2, 1_000);

    sc.next_tx(R1);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let _s = settlement::begin_settlement(&cap, &mut c, b"h", b"r"); // aborts
    abort
}

#[test, expected_failure(abort_code = settlement::EDatasetOrderMismatch)]
fun wrong_dataset_order_rejected() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build_and_fund(&mut sc, &clk, id1, id2, 1_000);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let ds2 = sc.take_shared_by_id<Dataset>(id2);
    let mut s = settlement::begin_settlement(&cap, &mut c, b"h", b"r");
    settlement::pay_dataset(&mut s, &mut c, &ds2, sc.ctx()); // ds2 at index 0 -> abort
    abort
}

#[test, expected_failure(abort_code = settlement::EIncompleteSettlement)]
fun incomplete_settlement_rejected() {
    let mut sc = ts::begin(ADMIN);
    let clk = clock::create_for_testing(sc.ctx());
    grant_provider(&mut sc, PROVIDER);
    let (id1, id2) = seed(&mut sc);
    build_and_fund(&mut sc, &clk, id1, id2, 1_000);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<ProviderCap>();
    let mut c = sc.take_shared<Campaign<SUI>>();
    let ds1 = sc.take_shared_by_id<Dataset>(id1);
    let mut s = settlement::begin_settlement(&cap, &mut c, b"h", b"r");
    settlement::pay_dataset(&mut s, &mut c, &ds1, sc.ctx()); // only 1 of 2
    settlement::finish_settlement(s, &mut c, &clk, sc.ctx()); // aborts
    abort
}
