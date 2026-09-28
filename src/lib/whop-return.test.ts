import assert from "node:assert/strict";
import test from "node:test";
import { checkoutReturnStatus } from "./whop-return.ts";

test("Whop return statuses map to success, error, or still pending", () => {
  assert.equal(checkoutReturnStatus("success"), "success");
  assert.equal(checkoutReturnStatus("ERROR"), "error");
  assert.equal(checkoutReturnStatus(undefined), "pending");
  assert.equal(checkoutReturnStatus("cancelled"), "pending");
});
