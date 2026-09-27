import assert from "node:assert/strict";
import test from "node:test";
import { statementForNeon } from "../../scripts/neon-schema.mjs";
import { whopPaymentsSchemaSql } from "../../scripts/ensure-whop-payments-table.mjs";
import { CREATE_WHOP_PAYMENTS } from "./whop-payments.ts";

function compact(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

test("db/whop_payments.sql is the statement the app runs at runtime", () => {
  assert.equal(compact(statementForNeon(whopPaymentsSchemaSql())), compact(CREATE_WHOP_PAYMENTS));
});
