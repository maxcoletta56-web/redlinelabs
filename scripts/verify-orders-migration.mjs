/**
 * Applies the generated orders migration to a real Postgres via psql.
 * Temporary verification harness: run with PGURL pointing at a scratch server.
 */
import { execFileSync } from "node:child_process";
import { legacyTableName, ordersMigrationSql } from "./orders-migration.mjs";

const baseUrl = process.env.PGURL;
if (!baseUrl) throw new Error("Set PGURL to a postgres connection string");

function psql(url, sql) {
  return execFileSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-X", "-q", "-A", "-t", "-f", "-"], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

function scratchDatabase(name) {
  psql(baseUrl, `DROP DATABASE IF EXISTS ${name}; CREATE DATABASE ${name};`);
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

function columnsOf(url, table) {
  return psql(
    url,
    `SELECT string_agg(column_name, ',' ORDER BY ordinal_position) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${table}'`,
  );
}

function legacyTables(url) {
  return psql(
    url,
    `SELECT coalesce(string_agg(table_name, ',' ORDER BY table_name), '') FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name LIKE 'orders_legacy_stripe%'`,
  );
}

function migrate(url) {
  const taken = legacyTables(url).split(",").filter(Boolean);
  const sql = ordersMigrationSql({ legacyName: legacyTableName(taken) });
  psql(url, sql);
}

function check(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
  if (!ok) {
    console.log(`      expected: ${expected}`);
    console.log(`      actual:   ${actual}`);
    process.exitCode = 1;
  }
}

const ORDERS =
  "reference,status,currency,subtotal_cents,total_cents,promo_code,first_name,last_name,email,items,shipping,created_at,paid_at";

const INSERT_ORDER = `INSERT INTO orders
  (reference, currency, subtotal_cents, total_cents, promo_code, first_name, last_name, email, items, shipping)
  VALUES ('RL-TEST-0001', 'aud', 9900, 9900, null, 'Ada', 'Lovelace', 'ada@example.com', '[]'::jsonb, null)
  RETURNING reference`;

console.log("--- scenario 1: the production shape, a Stripe-era orders table with rows");
const legacy = scratchDatabase("scenario_legacy");
psql(
  legacy,
  `CREATE TABLE orders (
     id SERIAL PRIMARY KEY,
     stripe_session_id TEXT NOT NULL,
     amount_total INTEGER NOT NULL,
     created TIMESTAMPTZ NOT NULL DEFAULT now()
   );
   INSERT INTO orders (stripe_session_id, amount_total) VALUES ('cs_test_1', 12300), ('cs_test_2', 4500);`,
);
check("checkout insert fails before the migration", psqlFails(legacy, INSERT_ORDER), true);
migrate(legacy);
check("orders now matches db/orders.sql", columnsOf(legacy, "orders"), ORDERS);
check("legacy table kept", legacyTables(legacy), "orders_legacy_stripe");
check(
  "legacy rows kept",
  psql(legacy, "SELECT count(*) || ':' || string_agg(stripe_session_id, ',' ORDER BY id) FROM orders_legacy_stripe"),
  "2:cs_test_1,cs_test_2",
);
check("checkout insert succeeds after the migration", psql(legacy, INSERT_ORDER), "RL-TEST-0001");

console.log("--- scenario 2: running it again is a no-op");
migrate(legacy);
check("orders unchanged", columnsOf(legacy, "orders"), ORDERS);
check("no second legacy table", legacyTables(legacy), "orders_legacy_stripe");
check("the order survives", psql(legacy, "SELECT reference FROM orders"), "RL-TEST-0001");

console.log("--- scenario 3: an empty database");
const fresh = scratchDatabase("scenario_fresh");
migrate(fresh);
check("orders created", columnsOf(fresh, "orders"), ORDERS);
check("no legacy table", legacyTables(fresh), "");
check("checkout insert succeeds", psql(fresh, INSERT_ORDER), "RL-TEST-0001");

console.log("--- scenario 4: a half-migrated table with rows");
const partial = scratchDatabase("scenario_partial");
psql(
  partial,
  `CREATE TABLE orders (
     reference TEXT PRIMARY KEY,
     status TEXT NOT NULL DEFAULT 'awaiting_payment',
     subtotal_cents INTEGER NOT NULL,
     total_cents INTEGER NOT NULL
   );
   INSERT INTO orders (reference, subtotal_cents, total_cents) VALUES ('RL-OLD-0001', 100, 100);`,
);
migrate(partial);
check("missing columns backfilled", columnsOf(partial, "orders"), ORDERS);
check("no rename happened", legacyTables(partial), "");
check("existing row kept", psql(partial, "SELECT reference FROM orders"), "RL-OLD-0001");
check("checkout insert succeeds", psql(partial, INSERT_ORDER), "RL-TEST-0001");

console.log("--- scenario 5: the legacy name is already taken");
const taken = scratchDatabase("scenario_taken");
psql(
  taken,
  `CREATE TABLE orders_legacy_stripe (id SERIAL PRIMARY KEY);
   CREATE TABLE orders (id SERIAL PRIMARY KEY, stripe_session_id TEXT);
   INSERT INTO orders (stripe_session_id) VALUES ('cs_test_9');`,
);
migrate(taken);
check("renamed to the next free name", legacyTables(taken), "orders_legacy_stripe,orders_legacy_stripe_2");
check("orders matches db/orders.sql", columnsOf(taken, "orders"), ORDERS);
check(
  "rows landed in the suffixed table",
  psql(taken, "SELECT stripe_session_id FROM orders_legacy_stripe_2"),
  "cs_test_9",
);

function psqlFails(url, sql) {
  try {
    psql(url, sql);
    return false;
  } catch (error) {
    console.log(`      psql rejected it: ${String(error.stderr ?? "").trim().split("\n")[0]}`);
    return true;
  }
}

console.log(process.exitCode ? "--- VERIFICATION FAILED" : "--- ALL CHECKS PASSED");
