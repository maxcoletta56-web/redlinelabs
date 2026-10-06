import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_PAYMENTS_PROVIDER, parsePaymentsProvider } from "./payments-provider.ts";

test("bank transfer is the default rail", () => {
  assert.equal(DEFAULT_PAYMENTS_PROVIDER, "bank_transfer");
  assert.equal(parsePaymentsProvider(undefined), "bank_transfer");
  assert.equal(parsePaymentsProvider(null), "bank_transfer");
  assert.equal(parsePaymentsProvider(""), "bank_transfer");
  assert.equal(parsePaymentsProvider("  "), "bank_transfer");
});

test("an unknown provider never silently enables a card processor", () => {
  assert.equal(parsePaymentsProvider("payoneer"), "bank_transfer");
  assert.equal(parsePaymentsProvider("stripe"), "bank_transfer");
  assert.equal(parsePaymentsProvider("stripe_connect"), "bank_transfer");
});

test("known providers are read case insensitively", () => {
  assert.equal(parsePaymentsProvider("paypal"), "paypal");
  assert.equal(parsePaymentsProvider(" PAYPAL "), "paypal");
  assert.equal(parsePaymentsProvider("Bank_Transfer"), "bank_transfer");
});
