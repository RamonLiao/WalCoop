#[test_only]
module data_coop::campaign_tests;

use data_coop::campaign;
use data_coop::dataset::{Self, Dataset};
use sui::clock;
use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;

const BUYER: address = @0xB1;
const PROVIDER: address = @0xB2;
const RETAILER: address = @0xC1;
const STRANGER: address = @0xD1;

// Register two listed datasets owned by RETAILER and return their ids.
fun seed_two_datasets(sc: &mut ts::Scenario): (ID, ID) {
    sc.next_tx(RETAILER);
    let id1 = dataset::register_for_testing(6000, sc.ctx());
    sc.next_tx(RETAILER);
    let id2 = dataset::register_for_testing(4000, sc.ctx());
    (id1, id2)
}

// Build + share a campaign over the two datasets. Returns nothing; campaign is
// shared. Must be called in its own tx where both datasets are takeable.
fun build_campaign(sc: &mut ts::Scenario, clk: &clock::Clock, id1: ID, id2: ID) {
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

#[test]
fun full_lifecycle_create_fund_issue() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed_two_datasets(&mut sc);
    build_campaign(&mut sc, &clk, id1, id2);

    // Weights snapshotted on-chain: 6000 + 4000 = 10000.
    sc.next_tx(BUYER);
    let mut c = sc.take_shared<campaign::Campaign<SUI>>();
    assert!(campaign::weight_total(&c) == 10_000, 0);
    assert!(campaign::status(&c) == campaign::status_pending(), 1);

    // Fund -> Active.
    let pay = coin::mint_for_testing<SUI>(1_000, sc.ctx());
    campaign::fund_campaign(&mut c, pay, sc.ctx());
    assert!(campaign::status(&c) == campaign::status_active(), 2);
    assert!(campaign::budget_value(&c) == 1_000, 3);

    // Issue ticket to provider.
    campaign::issue_access_ticket(&c, 10_000, &clk, sc.ctx());
    ts::return_shared(c);

    sc.next_tx(PROVIDER);
    let ticket = sc.take_from_sender<campaign::AccessTicket>();
    assert!(campaign::ticket_provider(&ticket) == PROVIDER, 4);
    assert!(campaign::ticket_covers(&ticket, id1), 5);
    assert!(campaign::ticket_covers(&ticket, id2), 6);
    campaign::destroy_ticket_for_testing(ticket);

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test]
fun cancel_refunds_buyer() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed_two_datasets(&mut sc);
    build_campaign(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<campaign::Campaign<SUI>>();
    let pay = coin::mint_for_testing<SUI>(500, sc.ctx());
    campaign::fund_campaign(&mut c, pay, sc.ctx());
    campaign::cancel_campaign(&mut c, sc.ctx());
    assert!(campaign::status(&c) == campaign::status_cancelled(), 0);
    assert!(campaign::budget_value(&c) == 0, 1);
    ts::return_shared(c);

    // Buyer received the refund coin.
    sc.next_tx(BUYER);
    let refund = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(refund.value() == 500, 2);
    coin::burn_for_testing(refund);

    clock::destroy_for_testing(clk);
    sc.end();
}

#[test, expected_failure(abort_code = campaign::ENotBuyer)]
fun stranger_cannot_fund() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed_two_datasets(&mut sc);
    build_campaign(&mut sc, &clk, id1, id2);

    sc.next_tx(STRANGER);
    let mut c = sc.take_shared<campaign::Campaign<SUI>>();
    let pay = coin::mint_for_testing<SUI>(100, sc.ctx());
    campaign::fund_campaign(&mut c, pay, sc.ctx());
    abort
}

#[test, expected_failure(abort_code = campaign::ECampaignNotActive)]
fun cannot_issue_ticket_before_funding() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed_two_datasets(&mut sc);
    build_campaign(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let c = sc.take_shared<campaign::Campaign<SUI>>();
    // Still Pending — no funds.
    campaign::issue_access_ticket(&c, 10_000, &clk, sc.ctx());
    abort
}

#[test, expected_failure(abort_code = campaign::EAlreadyFinalized)]
fun cannot_cancel_twice() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    let (id1, id2) = seed_two_datasets(&mut sc);
    build_campaign(&mut sc, &clk, id1, id2);

    sc.next_tx(BUYER);
    let mut c = sc.take_shared<campaign::Campaign<SUI>>();
    let pay = coin::mint_for_testing<SUI>(500, sc.ctx());
    campaign::fund_campaign(&mut c, pay, sc.ctx());
    campaign::cancel_campaign(&mut c, sc.ctx());
    campaign::cancel_campaign(&mut c, sc.ctx());
    abort
}

#[test, expected_failure(abort_code = campaign::EEmptyBasket)]
fun empty_basket_rejected() {
    let mut sc = ts::begin(BUYER);
    let clk = clock::create_for_testing(sc.ctx());
    sc.next_tx(BUYER);
    let b = campaign::new_campaign<SUI>(PROVIDER, &clk, sc.ctx());
    campaign::share_campaign(b, sc.ctx());
    abort
}

#[test, expected_failure(abort_code = campaign::EDatasetNotListed)]
fun unlisted_dataset_rejected() {
    let mut sc = ts::begin(RETAILER);
    let clk = clock::create_for_testing(sc.ctx());
    let id1 = dataset::register_for_testing(6000, sc.ctx());

    sc.next_tx(RETAILER);
    let mut ds = sc.take_shared_by_id<Dataset>(id1);
    dataset::set_listed(&mut ds, false, sc.ctx());

    let mut b = campaign::new_campaign<SUI>(PROVIDER, &clk, sc.ctx());
    campaign::add_dataset(&mut b, &ds); // aborts: not listed
    abort
}
