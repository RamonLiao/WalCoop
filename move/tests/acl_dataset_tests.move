#[test_only]
module data_coop::acl_dataset_tests;

use data_coop::acl;
use data_coop::dataset;
use sui::test_scenario as ts;

const ADMIN: address = @0xA;
const PROVIDER: address = @0xB;
const RETAILER: address = @0xC;
const STRANGER: address = @0xD;

#[test]
fun init_grants_publisher_cap_to_deployer() {
    let mut sc = ts::begin(ADMIN);
    acl::init_for_testing(sc.ctx());
    sc.next_tx(ADMIN);
    // Deployer holds exactly one PublisherCap.
    assert!(sc.has_most_recent_for_sender<acl::PublisherCap>(), 0);
    sc.end();
}

#[test]
fun publisher_can_grant_provider_cap() {
    let mut sc = ts::begin(ADMIN);
    acl::init_for_testing(sc.ctx());
    sc.next_tx(ADMIN);

    let pub = sc.take_from_sender<acl::PublisherCap>();
    acl::grant_and_transfer_provider_cap(&pub, PROVIDER, sc.ctx());
    sc.return_to_sender(pub);

    sc.next_tx(PROVIDER);
    let cap = sc.take_from_sender<acl::ProviderCap>();
    assert!(acl::provider(&cap) == PROVIDER, 1);
    acl::revoke_provider_cap(cap);
    sc.end();
}

#[test]
fun register_dataset_shares_object() {
    let mut sc = ts::begin(RETAILER);
    let pricing = dataset::new_pricing(0, 100);
    dataset::register_dataset(
        b"blob", b"inner", b"schema", b"daily-sales".to_string(), pricing, 5000, sc.ctx(),
    );
    sc.next_tx(RETAILER);
    let ds = sc.take_shared<dataset::Dataset>();
    assert!(dataset::owner(&ds) == RETAILER, 2);
    assert!(dataset::rev_share_bps(&ds) == 5000, 3);
    assert!(dataset::version(&ds) == 1, 4);
    ts::return_shared(ds);
    sc.end();
}

#[test]
fun owner_can_update_blob_bumps_version() {
    let mut sc = ts::begin(RETAILER);
    let pricing = dataset::new_pricing(0, 100);
    dataset::register_dataset(
        b"blob", b"inner", b"schema", b"d".to_string(), pricing, 5000, sc.ctx(),
    );
    sc.next_tx(RETAILER);
    let mut ds = sc.take_shared<dataset::Dataset>();
    dataset::update_blob(&mut ds, b"blob2", b"inner2", sc.ctx());
    assert!(dataset::version(&ds) == 2, 5);
    assert!(dataset::blob_id(&ds) == b"blob2", 6);
    ts::return_shared(ds);
    sc.end();
}

#[test, expected_failure(abort_code = dataset::ENotOwner)]
fun stranger_cannot_update_blob() {
    let mut sc = ts::begin(RETAILER);
    let pricing = dataset::new_pricing(0, 100);
    dataset::register_dataset(
        b"blob", b"inner", b"schema", b"d".to_string(), pricing, 5000, sc.ctx(),
    );
    sc.next_tx(STRANGER);
    let mut ds = sc.take_shared<dataset::Dataset>();
    dataset::update_blob(&mut ds, b"evil", b"evil", sc.ctx());
    ts::return_shared(ds);
    sc.end();
}

#[test, expected_failure(abort_code = dataset::EInvalidRevShare)]
fun rev_share_zero_rejected() {
    let mut sc = ts::begin(RETAILER);
    let pricing = dataset::new_pricing(0, 100);
    dataset::register_dataset(
        b"b", b"i", b"s", b"d".to_string(), pricing, 0, sc.ctx(),
    );
    sc.end();
}

#[test, expected_failure(abort_code = dataset::EInvalidPricingModel)]
fun unknown_pricing_model_rejected() {
    let sc = ts::begin(RETAILER);
    let _p = dataset::new_pricing(9, 100);
    sc.end();
}
