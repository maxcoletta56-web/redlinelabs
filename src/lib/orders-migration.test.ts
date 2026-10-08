import assert from "node:assert/strict";
import test from "node:test";
import { migrateOrdersTable } from "../../scripts/ensure-orders-table.mjs";
import { statementForNeon } from "../../scripts/neon-schema.mjs";
import {
  addColumnStatements,
  healedColumnDefinition,
  legacyTableName,
  ordersMigrationSql,
  ordersSchemaSql,
  parseColumnDefinitions,
} from "../../scripts/orders-migration.mjs";

const ORDERS_COLUMNS = [
  "reference",
  "status",
  "currency",
  "subtotal_cents",
  "total_cents",
  "promo_code",
  "first_name",
  "last_name",
  "email",
  "items",
  "shipping",
  "club_email",
  "club_points_redeemed",
  "created_at",
  "paid_at",
];

type FakeState = { columns: string[]; legacyTables: string[] };

/** Replays the state of `orders` before and after the migration statement. */
function fakeDatabase(states: FakeState[]) {
  const statements: string[] = [];
  let stage = 0;
  const query = async (sql: string) => {
    const state = states[Math.min(stage, states.length - 1)] as FakeState;
    if (sql.startsWith("SELECT column_name")) {
      return {
        rows: state.columns.map((name) => ({ column_name: name, data_type: "text" })),
      };
    }
    if (sql.startsWith("SELECT table_name")) {
      return { rows: state.legacyTables.map((table_name) => ({ table_name })) };
    }
    statements.push(sql);
    stage += 1;
    return { rows: [] };
  };
  return { query, statements };
}

async function runMigration(states: FakeState[]) {
  const fake = fakeDatabase(states);
  const logs: string[] = [];
  const errors: string[] = [];
  const ok = await migrateOrdersTable({
    connectionString: "postgresql://user:secret@ep-example.neon.tech/neondb",
    query: fake.query,
    log: (message: string) => logs.push(message),
    logError: (message: string) => errors.push(message),
  });
  return { ok, logs: logs.join("\n"), errors: errors.join("\n"), statements: fake.statements };
}

test("every column of db/orders.sql is read out of the create statement", () => {
  assert.deepEqual(
    parseColumnDefinitions(ordersSchemaSql()).map((column) => column.name),
    ORDERS_COLUMNS,
  );
});

test("each column gets an idempotent add so a half-migrated table self-heals", () => {
  const statements = addColumnStatements(ordersSchemaSql());
  assert.equal(statements.length, ORDERS_COLUMNS.length);
  for (const [index, column] of ORDERS_COLUMNS.entries()) {
    assert.match(
      String(statements[index]),
      new RegExp(`^ALTER TABLE public\\.orders ADD COLUMN IF NOT EXISTS ${column} `),
    );
  }
});

test("a backfilled column drops the constraints that fail on a table with rows", () => {
  assert.equal(healedColumnDefinition("TEXT PRIMARY KEY"), "TEXT");
  assert.equal(healedColumnDefinition("INTEGER NOT NULL"), "INTEGER");
  assert.equal(
    healedColumnDefinition("TIMESTAMPTZ NOT NULL DEFAULT now()"),
    "TIMESTAMPTZ NOT NULL DEFAULT now()",
  );
  assert.equal(healedColumnDefinition("JSONB"), "JSONB");
});

test("the legacy name steps past tables that already exist", () => {
  assert.equal(legacyTableName([]), "orders_legacy_stripe");
  assert.equal(legacyTableName(["orders"]), "orders_legacy_stripe");
  assert.equal(legacyTableName(["orders_legacy_stripe"]), "orders_legacy_stripe_2");
  assert.equal(
    legacyTableName(["orders_legacy_stripe", "orders_legacy_stripe_2"]),
    "orders_legacy_stripe_3",
  );
});

test("the migration is one statement Neon will accept", () => {
  const statement = ordersMigrationSql();
  assert.equal(statementForNeon(statement), statement);
  assert.match(statement, /^DO \$orders_migration\$/);
  assert.match(statement, /\$orders_migration\$$/);
  assert.equal(statement.split("$orders_migration$").length, 3);
});

test("the migration renames only a table that has no reference column", () => {
  const statement = ordersMigrationSql({ legacyName: "orders_legacy_stripe_2" });
  assert.match(statement, /IF to_regclass\('public\.orders'\) IS NOT NULL AND NOT EXISTS \(/);
  assert.match(statement, /column_name = 'reference'\s*\n?\s*\) THEN/);
  assert.match(statement, /ALTER TABLE public\.orders RENAME TO orders_legacy_stripe_2;/);
  assert.doesNotMatch(statement, /DROP TABLE|DELETE FROM|TRUNCATE/);
});

test("db/orders.sql stays the source of truth for the created table", () => {
  const statement = ordersMigrationSql();
  assert.ok(statement.includes(statementForNeon(ordersSchemaSql()).replace(/\n/g, "\n  ")));
});

test("an unexpected rename target is refused", () => {
  assert.throws(() => ordersMigrationSql({ legacyName: 'orders"; DROP TABLE orders --' }), {
    message: /Refusing to rename orders/,
  });
});

test("a stripe-era orders table is renamed aside, then the current one is created", async () => {
  const run = await runMigration([
    { columns: ["id", "stripe_session_id", "amount_total"], legacyTables: [] },
    { columns: ORDERS_COLUMNS, legacyTables: ["orders_legacy_stripe"] },
  ]);
  assert.equal(run.ok, true);
  assert.equal(run.statements.length, 1);
  assert.match(
    String(run.statements[0]),
    /ALTER TABLE public\.orders RENAME TO orders_legacy_stripe;/,
  );
  assert.match(run.logs, /no reference column; renaming it to orders_legacy_stripe/);
  assert.match(run.logs, /legacy rows kept in orders_legacy_stripe/);
  assert.equal(run.errors, "");
});

test("a second migration keeps the first legacy table", async () => {
  const run = await runMigration([
    { columns: ["id", "stripe_session_id"], legacyTables: ["orders_legacy_stripe"] },
    { columns: ORDERS_COLUMNS, legacyTables: ["orders_legacy_stripe", "orders_legacy_stripe_2"] },
  ]);
  assert.equal(run.ok, true);
  assert.match(
    String(run.statements[0]),
    /ALTER TABLE public\.orders RENAME TO orders_legacy_stripe_2;/,
  );
});

test("an already migrated table is only backfilled", async () => {
  const run = await runMigration([
    { columns: ORDERS_COLUMNS, legacyTables: [] },
    { columns: ORDERS_COLUMNS, legacyTables: [] },
  ]);
  assert.equal(run.ok, true);
  assert.match(run.logs, /already has a reference column/);
  assert.equal(run.errors, "");
});

test("the build fails when reference is still missing after the migration", async () => {
  const run = await runMigration([
    { columns: ["id", "stripe_session_id"], legacyTables: [] },
    { columns: ["id", "stripe_session_id"], legacyTables: [] },
  ]);
  assert.equal(run.ok, false);
  assert.match(run.errors, /"reference" is still missing/);
});

test("a failed migration reports without leaking the connection string", async () => {
  const errors: string[] = [];
  const ok = await migrateOrdersTable({
    connectionString: "postgresql://user:secret@ep-example.neon.tech/neondb",
    query: async () => {
      throw new Error("Neon SQL failed (400): postgresql://user:secret@ep-example.neon.tech/neondb");
    },
    log: () => {},
    logError: (message: string) => errors.push(message),
  });
  assert.equal(ok, false);
  assert.match(errors.join("\n"), /\[redacted\]/);
  assert.doesNotMatch(errors.join("\n"), /secret/);
});

test("no database url is a skip, not a failure", async () => {
  const logs: string[] = [];
  const ok = await migrateOrdersTable({
    connectionString: "",
    log: (message: string) => logs.push(message),
  });
  assert.equal(ok, true);
  assert.match(logs.join("\n"), /orders table: skipped \(DATABASE_URL is not set\)/);
});
