#[test_only]
module data_coop::access_tests;

use data_coop::access;
use data_coop::campaign;
use sui::clock;
use sui::test_scenario as ts;

const PROVIDER: address = @0xB2;
const STRANGER: address = @0xD1;

// A deterministic dummy campaign/dataset id and its byte form.
fun mk_ids(sc: &mut ts::Scenario): (ID, ID, vector<u8>) {
    // Mint two fresh UIDs to get real ids.
    let uid_a = object::new(sc.ctx());
    let uid_b = object::new(sc.ctx());
    let cid = object::uid_to_inner(&uid_a);
    let did = object::uid_to_inner(&uid_b);
    let did_bytes = object::id_to_bytes(&did);
    object::delete(uid_a);
    object::delete(uid_b);
    (cid, did, did_bytes)
}

#[test]
fun approve_succeeds_for_provider_in_scope() {
    let mut sc = ts::begin(PROVIDER);
    let clk = clock::create_for_testing(sc.ctx());
    let (cid, did, did_bytes) = mk_ids(&mut sc);

    let ticket = campaign::new_ticket_for_testing(cid, vector[did], PROVIDER, 10_000, sc.ctx());
    // clock at 0 < expiry 10_000, sender == PROVIDER, did in scope.
    access::seal_approve_for_testing(did_bytes, &ticket, &clk, sc.ctx());

    campaign::destroy_ticket_for_testing(ticket);
    clock::destroy_for_testing(clk);
    sc.end();
}

#[test, expected_failure(abort_code = access::EWrongProvider)]
fun approve_fails_for_stranger() {
    let mut sc = ts::begin(STRANGER);
    let clk = clock::create_for_testing(sc.ctx());
    let (cid, did, did_bytes) = mk_ids(&mut sc);

    let ticket = campaign::new_ticket_for_testing(cid, vector[did], PROVIDER, 10_000, sc.ctx());
    access::seal_approve_for_testing(did_bytes, &ticket, &clk, sc.ctx()); // sender=STRANGER
    abort
}

#[test, expected_failure(abort_code = access::EExpired)]
fun approve_fails_when_expired() {
    let mut sc = ts::begin(PROVIDER);
    let mut clk = clock::create_for_testing(sc.ctx());
    let (cid, did, did_bytes) = mk_ids(&mut sc);

    clk.set_for_testing(20_000); // now > expiry
    let ticket = campaign::new_ticket_for_testing(cid, vector[did], PROVIDER, 10_000, sc.ctx());
    access::seal_approve_for_testing(did_bytes, &ticket, &clk, sc.ctx());
    abort
}

#[test, expected_failure(abort_code = access::ENoAccess)]
fun approve_fails_out_of_scope() {
    let mut sc = ts::begin(PROVIDER);
    let clk = clock::create_for_testing(sc.ctx());
    let (cid, did, _did_bytes) = mk_ids(&mut sc);

    // Ticket covers `did`, but we ask to decrypt a different id.
    let uid_other = object::new(sc.ctx());
    let other_bytes = object::uid_to_bytes(&uid_other);
    object::delete(uid_other);

    let ticket = campaign::new_ticket_for_testing(cid, vector[did], PROVIDER, 10_000, sc.ctx());
    access::seal_approve_for_testing(other_bytes, &ticket, &clk, sc.ctx());
    abort
}
