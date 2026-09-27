import assert from "node:assert/strict";
import test from "node:test";
import { cartClearedStorageKey, shouldClearCart } from "./cart-clear.ts";

test("a success page with no order key always clears the cart", () => {
  assert.equal(shouldClearCart(undefined, false), true);
  assert.equal(shouldClearCart(undefined, true), true);
});

test("an order page clears the cart once per reference", () => {
  assert.equal(shouldClearCart("RL-7F3K2Q", false), true);
  assert.equal(shouldClearCart("RL-7F3K2Q", true), false);
});

test("the storage key is scoped to the order reference", () => {
  assert.equal(cartClearedStorageKey("RL-7F3K2Q"), "redline-cart-cleared:RL-7F3K2Q");
});
