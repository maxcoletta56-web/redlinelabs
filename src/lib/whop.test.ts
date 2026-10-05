import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { resolveCartLines } from "./order.ts";
import { orderAmountDueCents } from "./promo-pricing.ts";
import {
  centsToAudAmount,
  checkoutReturnOutcome,
  parseWhopWebhookEvent,
  resolveWhop,
  verifyWhopWebhook,
  whopAmountMatches,
  whopApiBase,
  whopCheckoutRequest,
  whopEmbedEnvironment,
  whopOrderId,
  whopPaymentId,
  WhopWebhookError,
} from "./whop.ts";

const secret = `whsec_${Buffer.from("sandbox-webhook-secret").toString("base64")}`;

function signed(body: string, timestamp: string) {
  const id = "msg_test_1";
  const digest = createHmac("sha256", Buffer.from(secret.slice("whsec_".length), "base64"))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  return { id, timestamp, signature: `v1,${digest}` };
}

test("sandbox is the default and the API key stays off the embed environment", () => {
  assert.equal(resolveWhop({}) , null);
  assert.equal(resolveWhop({ WHOP_API_KEY: "sk_test" }), null);
  const config = resolveWhop({ WHOP_API_KEY: "apik_test", WHOP_COMPANY_ID: "biz_test" });
  assert.ok(config);
  assert.equal(config?.environment, "sandbox");
  assert.equal(config?.apiBase, whopApiBase("sandbox"));
  assert.equal(whopEmbedEnvironment("sandbox"), "sandbox");
  assert.equal(resolveWhop({ WHOP_API_KEY: "apik_live", WHOP_COMPANY_ID: "biz_live", WHOP_ENV: "live" })?.environment, "live");
  assert.equal(whopEmbedEnvironment("live"), "production");
  assert.equal(config?.apiKey, "apik_test");
  assert.equal("NEXT_PUBLIC_WHOP_API_KEY" in (config ?? {}), false);
});

test("inline checkout pricing is the catalogue total in AUD, not a browser price", () => {
  const lines = resolveCartLines([{ slug: "bpc-157", option: "10", qty: 3 }]);
  const subtotal = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const due = orderAmountDueCents(subtotal, null);
  assert.equal(due.totalCents, 24030);
  const body = whopCheckoutRequest({
    companyId: "biz_test",
    totalCents: due.totalCents,
    orderId: "RL-234567",
    redirectUrl: "https://redlinelabs.shop/checkout/return/RL-234567",
  });
  assert.equal(body.currency, "aud");
  assert.equal(body.plan.currency, "aud");
  assert.equal(body.plan.initial_price, 240.3);
  assert.equal(body.plan.plan_type, "one_time");
  assert.equal(body.mode, "payment");
  assert.deepEqual(body.metadata, { orderId: "RL-234567" });
  assert.equal(centsToAudAmount(1995), 19.95);
  assert.equal(lines[0]?.unitAmountCents, 8900);
});

test("webhook signatures follow the standard webhooks payload", () => {
  const body = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_123" } });
  const timestamp = "1760000000";
  const headers = signed(body, timestamp);
  assert.doesNotThrow(() => verifyWhopWebhook(body, headers, secret, 1760000000));
  assert.throws(
    () => verifyWhopWebhook(body, { ...headers, signature: "v1,bm90LXZhbGlk" }, secret, 1760000000),
    WhopWebhookError,
  );
  assert.throws(
    () => verifyWhopWebhook(body, headers, secret, 1760000000 + 301),
    WhopWebhookError,
  );
  assert.throws(
    () => verifyWhopWebhook(body, { id: null, timestamp, signature: headers.signature }, secret, 1760000000),
    WhopWebhookError,
  );
});

test("payment metadata carries orderId and the amount must match the stored order", () => {
  const event = parseWhopWebhookEvent(
    JSON.stringify({
      type: "payment.succeeded",
      data: { id: "pay_sandbox_1", currency: "aud", total: 240.3, metadata: { orderId: "RL-234567" } },
    }),
  );
  assert.equal(event.type, "payment.succeeded");
  assert.equal(whopOrderId(event.data), "RL-234567");
  assert.equal(whopPaymentId(event.data), "pay_sandbox_1");
  assert.equal(whopAmountMatches(event.data, 24030), true);
  assert.equal(whopAmountMatches({ ...event.data, total: 1 }, 24030), false);
  assert.equal(whopAmountMatches({ ...event.data, currency: "usd" }, 24030), false);
  assert.equal(whopAmountMatches({ id: "pay_sandbox_1", metadata: { orderId: "RL-234567" } }, 24030), true);
  assert.equal(checkoutReturnOutcome("success"), "success");
  assert.equal(checkoutReturnOutcome("error"), "error");
  assert.equal(checkoutReturnOutcome(undefined), "unknown");
});
