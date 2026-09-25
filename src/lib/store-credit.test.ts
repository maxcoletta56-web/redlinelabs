import assert from "node:assert/strict";
import test from "node:test";
import { creditToApplyCents, serverStoreCreditCents } from "./store-credit.ts";

test("checkout ignores client-supplied store credit", () => {
  assert.equal(serverStoreCreditCents(), 0);
});

test("applies no credit when the balance or cart is empty", () => {
  assert.equal(creditToApplyCents(0, 8900), 0);
  assert.equal(creditToApplyCents(2500, 0), 0);
});

test("never reduces a Stripe charge below fifty cents", () => {
  assert.equal(creditToApplyCents(8900, 8900), 8850);
  assert.equal(creditToApplyCents(40, 40), 0);
});

test("applies the smaller of balance and remaining chargeable amount", () => {
  assert.equal(creditToApplyCents(1000, 8900), 1000);
  assert.equal(creditToApplyCents(20000, 12500), 12450);
});
