import assert from "node:assert/strict";
import test from "node:test";
import {
  checkoutBodySchema,
  contactBodySchema,
  checkoutSessionQuerySchema,
} from "./validation.ts";

test("checkout rejects client-supplied prices by only accepting slug/option/qty", () => {
  const parsed = checkoutBodySchema.safeParse({
    email: "max@example.com",
    ageConfirmed: true,
    researchUse: true,
    items: [{ slug: "bpc-157", option: "10", qty: 2, price: 1 }],
  });
  assert.equal(parsed.success, true);
  if (parsed.success) {
    assert.equal("price" in parsed.data.items[0], false);
    assert.equal(parsed.data.items[0].slug, "bpc-157");
  }
});

test("contact honeypot still parses so the route can drop it", () => {
  const parsed = contactBodySchema.safeParse({
    name: "Max",
    email: "max@example.com",
    message: "Need a COA",
    company: "spam",
  });
  assert.equal(parsed.success, true);
  if (parsed.success) assert.equal(parsed.data.company, "spam");
});

test("checkout session ids must look like Stripe checkout sessions", () => {
  assert.equal(checkoutSessionQuerySchema.safeParse({ session_id: "nope" }).success, false);
  assert.equal(checkoutSessionQuerySchema.safeParse({ session_id: "cs_test_abc" }).success, true);
});
