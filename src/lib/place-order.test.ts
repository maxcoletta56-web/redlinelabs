import assert from "node:assert/strict";
import test from "node:test";
import { createMemoryOrderStore } from "./orders.ts";
import { placeOrder, priceCart } from "./place-order.ts";
import { checkoutBodySchema } from "./validation.ts";

test("ignores a browser price and applies 10 percent at $200", () => {
  const parsed = checkoutBodySchema.safeParse({
    email: "buyer@example.com",
    ageConfirmed: true,
    researchUse: true,
    items: [{ slug: "dsip", option: "15", qty: 2, price: 1, unitAmountCents: 1 }],
  });
  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  const priced = priceCart(parsed.data.items, null);
  assert.equal(priced.subtotalCents, 22000);
  assert.equal(priced.volumeDiscountCents, 2200);
  assert.equal(priced.totalCents, 19800);
  assert.equal(priced.lines[0]?.unitAmountCents, 11000);
});

test("bank transfer stays pending and card checkout uses the server total", async () => {
  const store = createMemoryOrderStore();
  const items = [{ slug: "dsip", option: "15", qty: 2 }];
  const bank = await placeOrder(store, {
    items,
    email: "Buyer@Example.com",
    paymentMethod: "bank_transfer",
    env: {},
    returnUrlFor: (orderId) => `https://example.com/checkout/return?orderId=${orderId}`,
  });
  const bankOrder = await store.get(bank.orderId);
  assert.equal(bank.session, null);
  assert.equal(bankOrder?.status, "pending");
  assert.equal(bankOrder?.paymentMethod, "bank_transfer");
  assert.equal(bankOrder?.email, "buyer@example.com");
  assert.equal(bank.totalCents, 19800);

  const cardStore = createMemoryOrderStore();
  let charged = 0;
  const card = await placeOrder(cardStore, {
    items,
    email: "buyer@example.com",
    paymentMethod: "card",
    env: { WHOP_API_KEY: "sk_test", WHOP_COMPANY_ID: "biz_123" },
    returnUrlFor: (orderId) => `https://example.com/checkout/return?orderId=${orderId}`,
    fetchImpl: async (_url, init) => {
      const payload = JSON.parse(String(init?.body)) as {
        metadata: { orderId: string };
        plan: { initial_price: number };
      };
      charged = payload.plan.initial_price;
      assert.equal(payload.metadata.orderId.startsWith("ord_"), true);
      return new Response(JSON.stringify({ id: "ch_test", plan: { id: "plan_test" } }), { status: 200 });
    },
  });
  assert.equal(charged, 198);
  assert.equal(card.session?.environment, "sandbox");
  assert.equal((await cardStore.get(card.orderId))?.whopCheckoutId, "ch_test");
  assert.equal((await cardStore.get(card.orderId))?.status, "pending");
});
