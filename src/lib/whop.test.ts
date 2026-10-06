import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  buildCheckoutConfigurationBody,
  parseWhopPaymentEvent,
  postCheckoutConfiguration,
  priceCardOrder,
  resolveWhop,
  resolveWhopEnvironment,
  verifyWhopWebhook,
  webhookKeyBytes,
  whopApiOrigin,
  whopDollars,
} from "./whop.ts";

test("sandbox is the default Whop environment", () => {
  assert.equal(resolveWhopEnvironment({}), "sandbox");
  assert.equal(resolveWhopEnvironment({ WHOP_ENV: "sandbox" }), "sandbox");
  assert.equal(resolveWhopEnvironment({ WHOP_ENV: "production" }), "production");
  assert.equal(whopApiOrigin("sandbox"), "https://sandbox-api.whop.com");
  assert.equal(whopApiOrigin("production"), "https://api.whop.com");
});

test("card checkout stays closed until the server secrets are all set", () => {
  assert.equal(resolveWhop({ WHOP_API_KEY: "key", WHOP_COMPANY_ID: "biz_1" }), null);
  const config = resolveWhop({
    WHOP_API_KEY: "key",
    WHOP_COMPANY_ID: "biz_1",
    WHOP_WEBHOOK_SECRET: "secret",
  });
  assert.equal(config?.environment, "sandbox");
  assert.equal(config?.apiKey, "key");
});

test("the charged amount comes from the catalogue, including the $200 discount", () => {
  const priced = priceCardOrder(
    [{ slug: "bpc-157", option: "10", qty: 3, price: 1 } as { slug: string; option: string; qty: number }],
    null,
  );
  assert.equal(priced.catalogCents, 26700);
  assert.equal(priced.volumeCents, 2670);
  assert.equal(priced.totalCents, 24030);
  assert.equal(whopDollars(priced.totalCents), 240.3);
});

test("inline pricing is AUD and the order id is metadata, not a browser price", () => {
  const body = buildCheckoutConfigurationBody({
    companyId: "biz_test",
    orderId: "RL-7F3K2Q",
    totalCents: 24030,
    returnUrl: "https://redlinelabs.shop/checkout/return/RL-7F3K2Q",
    title: "Order RL-7F3K2Q",
  });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.plan.plan_type, "one_time");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(body.metadata.orderId, "RL-7F3K2Q");
  assert.equal("price" in body, false);
  assert.equal(body.plan.adaptive_pricing_enabled, false);
});

test("checkout configuration is created on the sandbox API", async () => {
  const calls: string[] = [];
  const session = await postCheckoutConfiguration(
    { apiKey: "test-key", environment: "sandbox" },
    buildCheckoutConfigurationBody({
      companyId: "biz_test",
      orderId: "RL-7F3K2Q",
      totalCents: 8900,
      returnUrl: "https://example.com/checkout/return/RL-7F3K2Q",
      title: "Order RL-7F3K2Q",
    }),
    async (url, init) => {
      calls.push(`${init?.method} ${url}`);
      assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer test-key");
      const sent = JSON.parse(String(init?.body)) as { plan: { currency: string; initial_price: number } };
      assert.equal(sent.plan.currency, "aud");
      assert.equal(sent.plan.initial_price, 89);
      return new Response(JSON.stringify({ id: "ch_testsession", plan: { id: "plan_testplan" } }), {
        status: 200,
      });
    },
  );
  assert.deepEqual(calls, ["POST https://sandbox-api.whop.com/api/v1/checkout_configurations"]);
  assert.equal(session.sessionId, "ch_testsession");
  assert.equal(session.planId, "plan_testplan");
});

function signed(payload: string, secret: string, timestamp: string, id = "msg_test") {
  const key = webhookKeyBytes(secret);
  const digest = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return { id, timestamp, signature: `v1,${digest}` };
}

test("a webhook signature is required and a replay outside five minutes is rejected", () => {
  const secret = "whsec_" + Buffer.from("sandbox-secret").toString("base64");
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_testpayment", metadata: { orderId: "RL-7F3K2Q" } },
  });
  const now = 1_700_000_000;
  const headers = signed(payload, secret, String(now));
  const verified = verifyWhopWebhook(payload, headers, secret, now);
  assert.deepEqual(parseWhopPaymentEvent(verified), {
    type: "payment.succeeded",
    paymentId: "pay_testpayment",
    orderId: "RL-7F3K2Q",
  });
  assert.throws(
    () => verifyWhopWebhook(payload, headers, secret, now + 301),
    /tolerance/,
  );
  assert.throws(
    () => verifyWhopWebhook(payload, { ...headers, signature: "v1,aaaa" }, secret, now),
    /signature/,
  );
});

test("payment.failed is recognised and an unknown event is ignored", () => {
  assert.deepEqual(
    parseWhopPaymentEvent({
      type: "payment.failed",
      data: { id: "pay_failedpayment", metadata: { order_id: "RL-7F3K2Q" } },
    }),
    { type: "payment.failed", paymentId: "pay_failedpayment", orderId: "RL-7F3K2Q" },
  );
  assert.equal(parseWhopPaymentEvent({ type: "membership.activated", data: { id: "pay_x" } }), null);
});
