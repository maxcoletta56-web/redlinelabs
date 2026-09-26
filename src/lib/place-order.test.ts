import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryOrderStore } from "./orders.ts";
import { placeOrder } from "./place-order.ts";
import { buildCheckoutConfiguration, centsToAudAmount, whopMode } from "./whop-checkout.ts";

test("sandbox is the default Whop environment", () => {
  assert.equal(whopMode({}), "sandbox");
  assert.equal(whopMode({ WHOP_ENV: "production" }), "production");
  assert.equal(centsToAudAmount(22500), 225);
});

test("inline checkout pricing is AUD and ignores a browser price", async () => {
  const store = createMemoryOrderStore();
  let charged = 0;
  const placed = await placeOrder(store, {
    items: [{ slug: "bpc-157", option: "20", qty: 2, price: 1 } as { slug: string; option: string; qty: number }],
    email: "Max@Example.com",
    paymentMethod: "card",
    env: { WHOP_API_KEY: "apik_test", WHOP_COMPANY_ID: "biz_test", WHOP_ENV: "sandbox" },
    returnUrlFor: (orderId) => `https://shop.example/checkout/return?order=${orderId}`,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { plan: { initial_price: number; currency: string }; metadata: { orderId: string } };
      charged = body.plan.initial_price;
      assert.equal(body.plan.currency, "aud");
      assert.equal(body.metadata.orderId.startsWith("ord_"), true);
      return new Response(JSON.stringify({ id: "ch_sandbox" }), { status: 200 });
    },
  });
  assert.equal(charged, 225);
  assert.equal(placed.order.totalCents, 22500);
  assert.equal(placed.order.volumeDiscountCents, 2500);
  assert.equal(placed.order.email, "max@example.com");
  assert.equal(placed.order.status, "pending");
  assert.equal(placed.sessionId, "ch_sandbox");
  assert.equal(placed.environment, "sandbox");
});

test("checkout configuration attaches orderId and enables card only", () => {
  const body = buildCheckoutConfiguration({
    companyId: "biz_test",
    orderId: "ord_abc",
    amountCents: 18000,
    returnUrl: "https://shop.example/checkout/return?order=ord_abc",
  });
  assert.equal(body.metadata.orderId, "ord_abc");
  assert.deepEqual(body.plan.payment_method_configuration.enabled, ["card"]);
  assert.equal(body.plan.initial_price, 180);
  assert.equal(body.plan.currency, "aud");
});
