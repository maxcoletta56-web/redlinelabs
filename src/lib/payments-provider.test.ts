import assert from "node:assert/strict";
import test from "node:test";
import {
  CHECKOUT_METHOD_LABELS,
  DEFAULT_PAYMENTS_PROVIDER,
  checkoutPaymentChoices,
  checkoutSurface,
  parsePaymentsProvider,
  paypalCheckoutOffered,
  resolveRequestedPaymentMethod,
} from "./payments-provider.ts";

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

test("PayPal is hidden unless credentials exist and the kill switch is off", () => {
  assert.equal(paypalCheckoutOffered(undefined, false), false);
  assert.equal(paypalCheckoutOffered("paypal", false), false);
  assert.equal(paypalCheckoutOffered("bank_transfer", false), false);
  assert.equal(paypalCheckoutOffered("bank_transfer_only", true), false);
  assert.equal(paypalCheckoutOffered(" BANK_TRANSFER_ONLY ", true), false);
  assert.equal(paypalCheckoutOffered(undefined, true), true);
  assert.equal(paypalCheckoutOffered("bank_transfer", true), true);
  assert.equal(paypalCheckoutOffered("paypal", true), true);
});

test("checkout offers PayID by default and PayPal beside it when both can run", () => {
  const hidden = checkoutPaymentChoices({
    envValue: "bank_transfer",
    paypalConfigured: false,
    bankTransferConfigured: true,
  });
  assert.equal(hidden.showChoice, false);
  assert.deepEqual(hidden.methods, ["bank_transfer"]);
  assert.equal(hidden.defaultMethod, "bank_transfer");

  const killed = checkoutPaymentChoices({
    envValue: "bank_transfer_only",
    paypalConfigured: true,
    bankTransferConfigured: true,
  });
  assert.equal(killed.showChoice, false);
  assert.deepEqual(killed.methods, ["bank_transfer"]);

  const both = checkoutPaymentChoices({
    envValue: "paypal",
    paypalConfigured: true,
    bankTransferConfigured: true,
  });
  assert.equal(both.showChoice, true);
  assert.deepEqual(both.methods, ["bank_transfer", "paypal"]);
  assert.equal(both.defaultMethod, "bank_transfer");
  assert.equal(CHECKOUT_METHOD_LABELS.bank_transfer, "Pay by PayID / bank transfer");
  assert.equal(CHECKOUT_METHOD_LABELS.paypal, "Pay with PayPal or card");
});

test("card checkout sits beside PayID when Whop is configured", () => {
  const both = checkoutPaymentChoices({
    envValue: "bank_transfer",
    paypalConfigured: false,
    bankTransferConfigured: true,
    whopConfigured: true,
  });
  assert.equal(both.showChoice, true);
  assert.deepEqual(both.methods, ["bank_transfer", "whop"]);
  assert.equal(both.defaultMethod, "bank_transfer");
  assert.equal(CHECKOUT_METHOD_LABELS.whop, "Pay by card");

  const killed = checkoutPaymentChoices({
    envValue: "bank_transfer_only",
    paypalConfigured: false,
    bankTransferConfigured: true,
    whopConfigured: true,
  });
  assert.deepEqual(killed.methods, ["bank_transfer"]);

  assert.equal(
    resolveRequestedPaymentMethod({
      requested: "whop",
      whopOffered: true,
      paypalOffered: false,
    }),
    "whop",
  );
  assert.equal(
    resolveRequestedPaymentMethod({
      requested: "card",
      whopOffered: false,
      paypalOffered: false,
    }),
    "unavailable",
  );
});

test("a legacy paypal env without PayID stays on the PayPal page", () => {
  const missing = checkoutSurface({
    envValue: "paypal",
    paypalConfigured: false,
    bankTransferConfigured: false,
  });
  assert.equal(missing.showChoice, false);
  assert.equal(missing.defaultMethod, "paypal");
  assert.equal(missing.setup, "paypal");

  const ready = checkoutSurface({
    envValue: "bank_transfer",
    paypalConfigured: false,
    bankTransferConfigured: true,
  });
  assert.equal(ready.showChoice, false);
  assert.equal(ready.defaultMethod, "bank_transfer");
  assert.equal(ready.setup, null);
});

test("an omitted payment method follows the legacy rail", () => {
  assert.equal(
    resolveRequestedPaymentMethod({ envValue: "paypal", paypalOffered: true }),
    "paypal",
  );
  assert.equal(
    resolveRequestedPaymentMethod({ envValue: "bank_transfer", paypalOffered: true }),
    "bank_transfer",
  );
  assert.equal(
    resolveRequestedPaymentMethod({
      requested: "paypal",
      envValue: "bank_transfer_only",
      paypalOffered: false,
    }),
    "unavailable",
  );
  assert.equal(
    resolveRequestedPaymentMethod({
      requested: "bank_transfer",
      envValue: "paypal",
      paypalOffered: true,
    }),
    "bank_transfer",
  );
});
