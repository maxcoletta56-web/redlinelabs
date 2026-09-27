import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neonQuery, resultRows, schemaDatabaseUrl } from "./neon-schema.mjs";
import { legacyTableName, ordersMigrationSql, ordersSchemaSql } from "./orders-migration.mjs";

export { ordersSchemaSql };

const COLUMNS_QUERY =
  "SELECT column_name, data_type FROM information_schema.columns " +
  "WHERE table_schema = 'public' AND table_name = 'orders' ORDER BY ordinal_position";

const LEGACY_TABLES_QUERY =
  "SELECT table_name FROM information_schema.tables " +
  "WHERE table_schema = 'public' AND table_name LIKE 'orders_legacy_stripe%' ORDER BY table_name";

async function inspectOrders(query) {
  const columns = resultRows(await query(COLUMNS_QUERY)).map((row) => ({
    name: row.column_name,
    type: row.data_type,
  }));
  const legacyTables = resultRows(await query(LEGACY_TABLES_QUERY)).map((row) => row.table_name);
  return {
    // A table always has at least one column, so no columns means no table.
    exists: columns.length > 0,
    hasReference: columns.some((column) => column.name === "reference"),
    columns,
    legacyTables,
  };
}

/**
 * Brings `orders` up to db/orders.sql without dropping anything, and reports
 * whether checkout can insert afterwards. Returns false instead of throwing so
 * the caller decides how loudly to fail.
 */
export async function migrateOrdersTable(options = {}) {
  const {
    connectionString = schemaDatabaseUrl(),
    query = (sql) => neonQuery(connectionString, sql),
    log = console.log,
    logError = console.error,
  } = options;

  if (!connectionString) {
    log("orders table: skipped (DATABASE_URL is not set)");
    return true;
  }

  try {
    const before = await inspectOrders(query);
    const legacyName = legacyTableName(before.legacyTables);
    const renaming = before.exists && !before.hasReference;
    if (renaming) {
      log(
        `orders table: found a pre-existing table with no reference column; renaming it to ${legacyName} and creating the current one`,
      );
    } else if (!before.exists) {
      log("orders table: not present; creating it from db/orders.sql");
    } else {
      log("orders table: already has a reference column; backfilling any missing columns");
    }

    await query(ordersMigrationSql({ legacyName }));

    const after = await inspectOrders(query);
    const summary = after.columns.map((column) => `${column.name} ${column.type}`).join(", ");
    log(`orders table: ${summary}`);
    if (renaming) {
      log(`orders table: legacy rows kept in ${legacyName} (nothing was dropped)`);
    }
    if (after.legacyTables.length > 0) {
      log(`orders table: legacy tables present: ${after.legacyTables.join(", ")}`);
    }

    if (!after.hasReference) {
      logError(
        'orders table: migration finished but "reference" is still missing, so POST /api/checkout would fail. Refusing to build.',
      );
      return false;
    }
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("orders table: failed to migrate to db/orders.sql");
    logError(message.replaceAll(connectionString, "[redacted]"));
    return false;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  if (!(await migrateOrdersTable())) process.exit(1);
}
