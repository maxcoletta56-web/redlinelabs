import assert from "node:assert/strict";
import test from "node:test";
import { shouldInviteOnPath } from "./club-invite.ts";

test("the join popup shows on shop, product and cart pages", () => {
  for (const path of ["/shop", "/shop/peptides", "/product/bpc-157", "/cart"]) {
    assert.equal(shouldInviteOnPath(path), true, path);
  }
});

test("the join popup never shows on checkout or other pages", () => {
  for (const path of ["/checkout", "/checkout/success", "/club", "/club/balance", "/order/RL-7F3K2Q", "/", "/admin/orders", "/shopping", "/cartoon"]) {
    assert.equal(shouldInviteOnPath(path), false, path);
  }
});
