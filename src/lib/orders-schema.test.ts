import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { ordersSchemaSql } from "../../scripts/ensure-orders-table.mjs";
import { schemaSql, statementForNeon } from "../../scripts/neon-schema.mjs";
import { CREATE_ORDERS } from "./orders.ts";
import { CREATE_WHOP_PAYMENTS } from "./whop-payments.ts";

function compact(sql: string) {
  return sql.replace(/\s+/g, " ").trim();
}

test("db/orders.sql is the statement the app runs at runtime", () => {
  assert.equal(compact(statementForNeon(ordersSchemaSql())), compact(CREATE_ORDERS));
});

test("the orders schema is one statement Neon will accept", () => {
  const statement = statementForNeon(ordersSchemaSql());
  assert.equal(statement.endsWith(";"), false);
  assert.equal(statement.split(";").length, 1);
  assert.match(statement, /^CREATE TABLE IF NOT EXISTS orders/);
});

test("db/whop_payments.sql is the statement the webhook runtime runs", () => {
  assert.equal(compact(statementForNeon(schemaSql("whop_payments.sql"))), compact(CREATE_WHOP_PAYMENTS));
});

test("schema apply skips when no database url is set", () => {
  const result = spawnSync(process.execPath, ["scripts/ensure-orders-table.mjs"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /orders table: skipped/);
});
