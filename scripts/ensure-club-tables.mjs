import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neonQuery, schemaDatabaseUrl, schemaSql, statementForNeon } from "./neon-schema.mjs";

/** Neon's SQL-over-HTTP endpoint takes one statement per request. */
function clubStatements() {
  return schemaSql("club.sql")
    .split(";")
    .map((statement) => statementForNeon(statement))
    .filter(Boolean);
}

/**
 * Applies db/club.sql. The two club columns on `orders` come from
 * db/orders.sql via the orders migration, which runs first. Returns false
 * instead of throwing so the build step decides how loudly to fail; a missing
 * DATABASE_URL is a skip, exactly like the orders migration.
 */
export async function ensureClubTables(options = {}) {
  const {
    connectionString = schemaDatabaseUrl(),
    query = (sql) => neonQuery(connectionString, sql),
    log = console.log,
    logError = console.error,
  } = options;

  if (!connectionString) {
    log("club tables: skipped (DATABASE_URL is not set)");
    return true;
  }

  try {
    for (const statement of clubStatements()) {
      await query(statement);
    }
    log("club tables: club_members and club_points_ledger are in place");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("club tables: failed to apply db/club.sql");
    logError(message.replaceAll(connectionString, "[redacted]"));
    return false;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  if (!(await ensureClubTables())) process.exit(1);
}
