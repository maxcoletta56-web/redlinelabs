import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { neonQuery, schemaDatabaseUrl, schemaSql, statementForNeon } from "./neon-schema.mjs";

/** Neon's SQL-over-HTTP endpoint takes one statement per request. */
export function distributionStatements() {
  return schemaSql("distribution.sql")
    .split(";")
    .map((statement) => statementForNeon(statement))
    .filter(Boolean);
}

/**
 * Applies db/distribution.sql. Idempotent. A missing DATABASE_URL skips the
 * step, matching the orders and club migrations.
 */
export async function ensureDistributionTables(options = {}) {
  const {
    connectionString = schemaDatabaseUrl(),
    query = (sql, params) => neonQuery(connectionString, sql, params),
    log = console.log,
    logError = console.error,
  } = options;

  if (!connectionString) {
    log("distribution tables: skipped (DATABASE_URL is not set)");
    return true;
  }

  try {
    for (const statement of distributionStatements()) {
      await query(statement);
    }
    log("distribution tables: distribution_accounts and distribution_quotes are in place");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logError("distribution tables: failed to apply db/distribution.sql");
    logError(message.replaceAll(connectionString, "[redacted]"));
    return false;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  if (!(await ensureDistributionTables())) process.exit(1);
}
