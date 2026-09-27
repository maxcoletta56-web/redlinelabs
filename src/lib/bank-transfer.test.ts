import assert from "node:assert/strict";
import test from "node:test";
import { resolveBankTransfer, transferDescription } from "./bank-transfer.ts";

test("both PayID values are required before checkout is offered", () => {
  assert.equal(resolveBankTransfer({}), undefined);
  assert.equal(resolveBankTransfer({ PAYID_ADDRESS: "pay@example.com" }), undefined);
  assert.equal(resolveBankTransfer({ PAYID_ACCOUNT_NAME: "Example Pty Ltd" }), undefined);
  assert.equal(
    resolveBankTransfer({ PAYID_ADDRESS: "  ", PAYID_ACCOUNT_NAME: "Example Pty Ltd" }),
    undefined,
  );
});

test("resolved PayID details are trimmed", () => {
  assert.deepEqual(
    resolveBankTransfer({
      PAYID_ADDRESS: " pay@example.com ",
      PAYID_ACCOUNT_NAME: " Example Pty Ltd ",
    }),
    { payId: "pay@example.com", accountName: "Example Pty Ltd" },
  );
});

test("the transfer description is the reference the customer sees", () => {
  assert.equal(transferDescription(" rl-7f3k2q "), "RL-7F3K2Q");
});
