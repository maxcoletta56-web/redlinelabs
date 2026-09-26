import assert from "node:assert/strict";
import test from "node:test";
import {
  audAmount,
  hostedPaymentPageUrl,
  isPayoneerListUrl,
  parsePayoneerList,
  payoneerListIsPaid,
  resolvePayoneer,
} from "./payoneer.ts";

const listUrl = "https://api.sandbox.oscato.com/pci/v1/listtoken123";

test("requires a merchant code and payment token", () => {
  assert.equal(resolvePayoneer({}), undefined);
  assert.equal(resolvePayoneer({ PAYONEER_MERCHANT_CODE: "merchant" }), undefined);
  const resolved = resolvePayoneer({
    PAYONEER_MERCHANT_CODE: " merchant ",
    PAYONEER_PAYMENT_TOKEN: " token ",
  });
  assert.deepEqual(resolved, {
    merchantCode: "merchant",
    paymentToken: "token",
    mode: "sandbox",
  });
});

test("production uses the live Payoneer API", () => {
  const resolved = resolvePayoneer({
    VERCEL_ENV: "production",
    PAYONEER_MERCHANT_CODE: "merchant",
    PAYONEER_PAYMENT_TOKEN: "token",
  });
  assert.equal(resolved?.mode, "live");
  assert.equal(
    resolvePayoneer({
      VERCEL_ENV: "production",
      PAYONEER_ENV: "sandbox",
      PAYONEER_MERCHANT_CODE: "merchant",
      PAYONEER_PAYMENT_TOKEN: "token",
    }),
    undefined,
  );
});

test("builds the hosted payment page from the list URL", () => {
  assert.equal(isPayoneerListUrl(listUrl, "sandbox"), true);
  assert.equal(isPayoneerListUrl("https://example.com/pci/v1/listtoken123", "sandbox"), false);
  assert.equal(
    hostedPaymentPageUrl("sandbox", listUrl),
    `https://resources.sandbox.oscato.com/paymentpage/v3/responsive.html?listUrl=${encodeURIComponent(listUrl)}`,
  );
});

test("reads a charged list and the catalogue amount", () => {
  assert.equal(audAmount(1999), 19.99);
  assert.throws(() => audAmount(0), /greater than zero/);
  const list = parsePayoneerList(
    {
      links: { self: listUrl },
      identification: { longId: "long123", transactionId: "rl_abc" },
      status: { code: "charged" },
      payment: { amount: 19.99, currency: "AUD" },
    },
    "sandbox",
  );
  assert.equal(payoneerListIsPaid(list.statusCode), true);
  assert.equal(payoneerListIsPaid("listed"), false);
  assert.equal(list.transactionId, "rl_abc");
});
