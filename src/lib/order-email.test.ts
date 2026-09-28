import assert from "node:assert/strict";
import test from "node:test";
import { orderConfirmationMessage, sendOrderConfirmation } from "./order-email.ts";
import type { StoredOrder } from "./orders.ts";

const order: StoredOrder = {
  reference: "RL-7F3K2Q",
  status: "paid",
  currency: "aud",
  subtotalCents: 24500,
  totalCents: 22050,
  promoCode: null,
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@example.com",
  items: [
    {
      slug: "retatrutide",
      name: "RETATRUTIDE (30)",
      option: "30",
      variantLabel: "MG",
      sku: "Ret1010",
      qty: 1,
      unitAmountCents: 24500,
    },
  ],
  shipping: null,
  createdAt: null,
  paidAt: null,
};

test("the confirmation names the order and the amount paid", () => {
  const message = orderConfirmationMessage(order);
  assert.equal(message.to, "ada@example.com");
  assert.match(message.subject, /RL-7F3K2Q/);
  assert.match(message.text, /220\.50/);
  assert.match(message.text, /RETATRUTIDE/);
});

test("sending requires the Resend key and from address", async () => {
  await assert.rejects(
    () => sendOrderConfirmation(order, {}, async () => new Response(null, { status: 500 })),
    /not configured/,
  );
});
