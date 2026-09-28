import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  audMajorUnits,
  checkoutConfigurationBody,
  createWhopCheckoutConfiguration,
  readWhopPaymentNotice,
  unwrapWhopWebhook,
} from "./whop.ts";

const SECRET = "ws_test_secret_value";

function signed(payload: string, secret = SECRET, at = new Date()) {
  const id = "msg_test";
  const timestamp = String(Math.floor(at.getTime() / 1000));
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}

test("the checkout price is the server total in AUD", () => {
  const body = checkoutConfigurationBody({
    accountId: "biz_test",
    reference: "RL-7F3K2Q",
    totalCents: 19_800,
    returnUrl: "https://redlinelabs.shop/checkout/complete?order=RL-7F3K2Q",
  });
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 198);
  assert.equal(body.metadata.orderId, "RL-7F3K2Q");
  assert.deepEqual(body.plan.payment_method_configuration, {
    enabled: ["card"],
    include_platform_defaults: false,
  });
  assert.equal(body.plan.three_ds_level, "frictionless_if_required");
  assert.equal(JSON.stringify(body).includes('"price":1'), false);
});

test("aud amounts keep two decimal places", () => {
  assert.equal(audMajorUnits(19_899), 198.99);
  assert.equal(audMajorUnits(10), 0.1);
});

test("a checkout configuration is created with the server body and a bearer key", async () => {
  let captured: { url: string; init: RequestInit } | null = null;
  const session = await createWhopCheckoutConfiguration({
    apiKey: "whop_test_key",
    environment: "sandbox",
    idempotencyKey: "RL-7F3K2Q",
    body: checkoutConfigurationBody({
      accountId: "biz_test",
      reference: "RL-7F3K2Q",
      totalCents: 11_000,
      returnUrl: "https://example.com/checkout/complete?order=RL-7F3K2Q",
    }),
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      captured = { url: String(url), init: init ?? {} };
      return new Response(JSON.stringify({ id: "ch_test", plan: { id: "plan_test" } }), { status: 200 });
    }) as typeof fetch,
  });
  assert.equal(session.sessionId, "ch_test");
  assert.equal(session.planId, "plan_test");
  assert.equal(captured?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  const headers = new Headers(captured?.init.headers);
  assert.equal(headers.get("Authorization"), "Bearer whop_test_key");
  assert.equal(headers.get("Idempotency-Key"), "RL-7F3K2Q");
  const sent = JSON.parse(String(captured?.init.body)) as { plan: { initial_price: number } };
  assert.equal(sent.plan.initial_price, 110);
});

test("webhook signatures accept the raw body and reject tampering", () => {
  const payload = JSON.stringify({
    type: "payment.succeeded",
    data: { id: "pay_test1", metadata: { orderId: "RL-7F3K2Q" } },
  });
  const event = unwrapWhopWebhook(payload, signed(payload), SECRET) as { type: string };
  assert.equal(event.type, "payment.succeeded");
  assert.equal(readWhopPaymentNotice(event)?.orderId, "RL-7F3K2Q");
  assert.throws(() => unwrapWhopWebhook(payload.replace("succeeded", "failed"), signed(payload), SECRET));
  assert.throws(() =>
    unwrapWhopWebhook(payload, signed(payload, SECRET, new Date(Date.now() - 10 * 60 * 1000)), SECRET),
  );
});

test("payment.requires_action is recognised and unknown events are ignored", () => {
  assert.equal(
    readWhopPaymentNotice({
      type: "payment.requires_action",
      data: { id: "pay_test1", metadata: { orderId: "RL-7F3K2Q" } },
    })?.type,
    "requires_action",
  );
  assert.equal(readWhopPaymentNotice({ type: "membership.activated", data: { id: "mem_1" } }), null);
});
