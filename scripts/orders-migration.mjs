import { schemaSql } from "./neon-schema.mjs";

/**
 * A Stripe-era `orders` table already exists in production, so
 * `CREATE TABLE IF NOT EXISTS orders` is a no-op there and the bank-transfer
 * columns never appear. The migration moves that table aside under this name
 * instead of dropping it, then creates the table db/orders.sql describes.
 */
export const LEGACY_TABLE_PREFIX = "orders_legacy_stripe";

const IDENTIFIER = /^[a-z_][a-z0-9_]*$/;

const TABLE_CONSTRAINT =
  /^(?:constraint|primary\s+key|unique|check|foreign\s+key|exclude|like)\b/i;

export function ordersSchemaSql() {
  return schemaSql("orders.sql");
}

function createTableBody(createSql) {
  const open = createSql.indexOf("(");
  const close = createSql.lastIndexOf(")");
  if (open === -1 || close < open) {
    throw new Error("db/orders.sql does not look like a CREATE TABLE statement");
  }
  return createSql.slice(open + 1, close);
}

/** Splits a CREATE TABLE body on the commas that separate column clauses. */
function columnClauses(createSql) {
  const clauses = [];
  let depth = 0;
  let current = "";
  for (const character of createTableBody(createSql)) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) {
      clauses.push(current);
      current = "";
      continue;
    }
    current += character;
  }
  clauses.push(current);
  return clauses.map((clause) => clause.trim()).filter(Boolean);
}

export function parseColumnDefinitions(createSql) {
  return columnClauses(createSql)
    .filter((clause) => !TABLE_CONSTRAINT.test(clause))
    .map((clause) => {
      const match = /^([a-z_][a-z0-9_]*)\s+([\s\S]+)$/i.exec(clause);
      if (!match) throw new Error(`Could not read a column name from "${clause}"`);
      return { name: match[1], definition: match[2].replace(/\s+/g, " ").trim() };
    });
}

/**
 * Backfilled columns are added nullable and without the primary key: both
 * fail on a table that already holds rows. Only a partially migrated database
 * reaches those statements — a table with no `reference` column is renamed
 * aside and recreated from db/orders.sql with the full definition — and the
 * app writes every column on insert, so the relaxed shape still accepts
 * orders.
 */
export function healedColumnDefinition(definition) {
  let healed = definition.replace(/\s*primary\s+key\b/i, "");
  if (!/\bdefault\b/i.test(healed)) healed = healed.replace(/\s*not\s+null\b/i, "");
  return healed.replace(/\s+/g, " ").trim();
}

export function addColumnStatements(createSql = ordersSchemaSql()) {
  return parseColumnDefinitions(createSql).map(
    ({ name, definition }) =>
      `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS ${name} ${healedColumnDefinition(definition)}`,
  );
}

/** Picks the first free `orders_legacy_stripe` name so no data is overwritten. */
export function legacyTableName(takenNames = []) {
  const taken = new Set(takenNames);
  if (!taken.has(LEGACY_TABLE_PREFIX)) return LEGACY_TABLE_PREFIX;
  for (let suffix = 2; suffix <= 100; suffix += 1) {
    const candidate = `${LEGACY_TABLE_PREFIX}_${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`No free ${LEGACY_TABLE_PREFIX} name is left to rename orders to`);
}

function indent(sql) {
  return sql
    .split("\n")
    .map((line) => (line ? `  ${line}` : line))
    .join("\n");
}

/**
 * One idempotent statement: a DO block runs in a single transaction, so either
 * the rename, the create, and every backfilled column land together or none of
 * them do. Neon's SQL-over-HTTP endpoint takes one statement per request, and
 * the semicolons inside the dollar-quoted body do not split it.
 */
export function ordersMigrationSql(options = {}) {
  const createSql = (options.createSql ?? ordersSchemaSql()).trim().replace(/;\s*$/, "");
  const legacyName = options.legacyName ?? LEGACY_TABLE_PREFIX;
  if (!IDENTIFIER.test(legacyName)) {
    throw new Error(`Refusing to rename orders to an unexpected name: ${legacyName}`);
  }
  if (createSql.includes("$orders_migration$")) {
    throw new Error("db/orders.sql must not contain the migration's dollar quote");
  }

  const backfill = addColumnStatements(createSql)
    .map((statement) => `  ${statement};`)
    .join("\n");
  const paymentIndex =
    "  CREATE UNIQUE INDEX IF NOT EXISTS orders_whop_payment_id_key ON public.orders (whop_payment_id) WHERE whop_payment_id IS NOT NULL;";

  return `DO $orders_migration$
BEGIN
  -- The Stripe-era table has no reference column, so the create below would
  -- silently keep its shape. Move it aside with its rows intact instead.
  IF to_regclass('public.orders') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'reference'
  ) THEN
    ALTER TABLE public.orders RENAME TO ${legacyName};
  END IF;

${indent(createSql)};

  -- Self-heal a database that was left part-way through this migration.
${backfill}

  -- One Whop payment can mark only one order paid.
${paymentIndex}
END
$orders_migration$`;
}
