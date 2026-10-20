import assert from "node:assert/strict";
import test from "node:test";
import { shouldInviteOnPath, shouldKeepInviteOpen } from "./club-invite.ts";

test("the join popup shows on the home page, shop, product and cart pages", () => {
  for (const path of ["/", "/shop", "/shop/peptides", "/product/bpc-157", "/cart"]) {
    assert.equal(shouldInviteOnPath(path), true, path);
  }
});

test("an open join popup closes on checkout, orders, and the membership page", () => {
  for (const path of ["/checkout", "/checkout/success", "/club", "/club/balance", "/order/RL-7F3K2Q"]) {
    assert.equal(shouldKeepInviteOpen(path, false), false, path);
  }
  assert.equal(shouldKeepInviteOpen("/", false), true);
  assert.equal(shouldKeepInviteOpen("/cart", false), true);
  assert.equal(shouldKeepInviteOpen("/product/bpc-157", false), true);
  assert.equal(shouldKeepInviteOpen("/shop", true), false);
});

test("the join popup never shows on checkout or other pages", () => {
  for (const path of ["/checkout", "/checkout/success", "/club", "/club/balance", "/order/RL-7F3K2Q", "/admin/orders", "/shopping", "/cartoon"]) {
    assert.equal(shouldInviteOnPath(path), false, path);
  }
});
