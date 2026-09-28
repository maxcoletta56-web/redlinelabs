import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import {
  audToCents,
  centsToAud,
  createWhopCheckoutConfiguration,
  parseWhopWebhook,
  paymentAmountMatches,
  resolveWhop,
  resolveWhopEnvironment,
  verifyWhopWebhook,
  whopApiBaseUrl,
  whopCheckoutPayload,
  WhopSignatureError,
  whopReturnStatus,
} from "./whop.ts";

const secretKey = Buffer.from("redline-whop-webhook-secret");
const secret = `whsec_${secretKey.toString("base64")}`;

function signedHeaders(body: string, timestamp = "1735689600") {
  const id = "msg_test_event";
  const signature = createHmac("sha256", secretKey).update(`${id}.${timestamp}.${body}`).digest("base64");
  return new Headers({
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  });
}

test("sandbox is the default Whop environment", () => {
  assert.equal(resolveWhopEnvironment(undefined), "sandbox");
  assert.equal(resolveWhopEnvironment("sandbox"), "sandbox");
  assert.equal(resolveWhopEnvironment("live"), "production");
  assert.equal(whopApiBaseUrl("sandbox"), "https://sandbox-api.whop.com/api/v1");
  assert.equal(whopApiBaseUrl("production"), "https://api.whop.com/api/v1");
});

test("card checkout stays closed until both Whop secrets are set", () => {
  assert.equal(resolveWhop({}), undefined);
  assert.equal(resolveWhop({ WHOP_API_KEY: "key" }), undefined);
  assert.equal(resolveWhop({ WHOP_WEBHOOK_SECRET: "whsec_abc" }), undefined);
  const config = resolveWhop({
    WHOP_API_KEY: " sandbox-key ",
    WHOP_WEBHOOK_SECRET: " whsec_abc ",
    WHOP_COMPANY_ID: " biz_123 ",
  });
  assert.equal(config?.apiKey, "sandbox-key");
  assert.equal(config?.webhookSecret, "whsec_abc");
  assert.equal(config?.environment, "sandbox");
  assert.equal(config?.companyId, "biz_123");
  assert.equal(
    resolveWhop({
      WHOP_API_KEY: "key",
      WHOP_WEBHOOK_SECRET: "ws_secret",
      WHOP_ENVIRONMENT: "production",
    })?.environment,
    "production",
  );
});

test("checkout configuration prices the server total in AUD and ignores a browser price", () => {
  const browserPrice = 1;
  const payload = whopCheckoutPayload({
    orderId: "RL-7F3K2Q",
    totalCents: 18_000,
    returnUrl: "https://redlinelabs.shop/checkout/complete?order=RL-7F3K2Q",
    companyId: "biz_123",
    productId: null,
  });
  const plan = payload.plan as { currency: string; initial_price: number; three_ds_level: string };
  assert.equal(plan.currency, "aud");
  assert.equal(plan.initial_price, 180);
  assert.equal(plan.three_ds_level, "frictionless_if_required");
  assert.equal(browserPrice, 1);
  assert.notEqual(plan.initial_price, browserPrice);
  assert.deepEqual(payload.metadata, { orderId: "RL-7F3K2Q" });
  assert.equal(payload.mode, "payment");
  assert.equal(payload.account_id, "biz_123");
  assert.equal(centsToAud(1995), 19.95);
  assert.equal(audToCents(19.95), 1995);
});

test("creates the checkout configuration against the sandbox API", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const session = await createWhopCheckoutConfiguration(
    {
      apiKey: "sandbox-key",
      webhookSecret: secret,
      environment: "sandbox",
      companyId: null,
      productId: null,
    },
    {
      orderId: "RL-7F3K2Q",
      totalCents: 18_000,
      returnUrl: "https://example.com/checkout/complete?order=RL-7F3K2Q",
      companyId: null,
      productId: null,
    },
    (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify({ id: "ch_session", plan: { id: "plan_inline" } }), {
        status: 200,
      });
    }) as typeof fetch,
  );
  assert.equal(session.sessionId, "ch_session");
  assert.equal(session.planId, "plan_inline");
  assert.equal(calls[0]?.url, "https://sandbox-api.whop.com/api/v1/checkout_configurations");
  const headers = calls[0]?.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, "Bearer sandbox-key");
  assert.equal(headers["Api-Version-Date"], "2026-09-25");
  assert.equal(headers["Idempotency-Key"], "RL-7F3K2Q");
  const body = JSON.parse(String(calls[0]?.init.body)) as { plan: { initial_price: number } };
  assert.equal(body.plan.initial_price, 180);
});

test("webhook signatures use the raw body and a ws_ secret as stored", () => {
  const body = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_abc12345" } });
  const payload = verifyWhopWebhook({
    body,
    headers: signedHeaders(body),
    secret,
    nowMs: 1_735_689_600_000,
  });
  assert.equal((payload as { type: string }).type, "payment.succeeded");

  const whopSecret = "ws_sandbox_secret";
  const id = "msg_ws";
  const timestamp = "1735689600";
  const whopSignature = createHmac("sha256", whopSecret)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const whopPayload = verifyWhopWebhook({
    body,
    headers: new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${whopSignature}`,
    }),
    secret: whopSecret,
    nowMs: 1_735_689_600_000,
  });
  assert.equal((whopPayload as { type: string }).type, "payment.succeeded");
  const encodedSecret = `whsec_${Buffer.from(whopSecret).toString("base64")}`;
  const encodedPayload = verifyWhopWebhook({
    body,
    headers: new Headers({
      "webhook-id": id,
      "webhook-timestamp": timestamp,
      "webhook-signature": `v1,${whopSignature}`,
    }),
    secret: encodedSecret,
    nowMs: 1_735_689_600_000,
  });
  assert.equal((encodedPayload as { type: string }).type, "payment.succeeded");

  assert.throws(
    () =>
      verifyWhopWebhook({
        body: `${body} `,
        headers: signedHeaders(body),
        secret,
        nowMs: 1_735_689_600_000,
      }),
    WhopSignatureError,
  );
  assert.throws(
    () =>
      verifyWhopWebhook({
        body,
        headers: signedHeaders(body, "100"),
        secret,
        nowMs: 1_735_689_600_000,
      }),
    WhopSignatureError,
  );
});

test("payment events keep orderId and the Whop payment id", () => {
  const parsed = parseWhopWebhook({
    type: "payment.succeeded",
    data: {
      id: "pay_abc12345",
      currency: "AUD",
      total: 180,
      metadata: { orderId: "rl-7f3k2q" },
    },
  });
  assert.equal(parsed.kind, "payment");
  if (parsed.kind !== "payment") return;
  assert.equal(parsed.notice.orderId, "RL-7F3K2Q");
  assert.equal(parsed.notice.paymentId, "pay_abc12345");
  assert.equal(parsed.notice.currency, "aud");
  assert.equal(paymentAmountMatches(parsed.notice, 18_000), true);
  assert.equal(paymentAmountMatches(parsed.notice, 18_001), false);
  assert.equal(parseWhopWebhook({ type: "membership.activated" }).kind, "ignore");
  assert.equal(parseWhopWebhook({ type: "payment.failed", data: { id: "nope" } }).kind, "invalid");
  assert.equal(whopReturnStatus("success"), "success");
  assert.equal(whopReturnStatus("error"), "error");
  assert.equal(whopReturnStatus(null), "pending");
});
