import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dbDir = join(dirname(fileURLToPath(import.meta.url)), "../db");

export function schemaSql(file) {
  return readFileSync(join(dbDir, file), "utf8").trim();
}

/** Neon’s HTTP SQL endpoint accepts one statement and rejects a trailing semicolon. */
export function statementForNeon(sql) {
  return sql.trim().replace(/;\s*$/, "");
}

export function schemaDatabaseUrl(env = process.env) {
  return env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || "";
}

/** SQL-over-HTTP is served by the direct compute host, not the pooled host. */
export function neonSqlEndpoint(connectionString) {
  const hostname = new URL(connectionString).hostname.replace("-pooler.", ".");
  return `https://${hostname}/sql`;
}

export async function neonQuery(connectionString, query) {
  const response = await fetch(neonSqlEndpoint(connectionString), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "neon-connection-string": connectionString,
    },
    body: JSON.stringify({ query, params: [] }),
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Neon SQL failed (${response.status}): ${body.slice(0, 300)}`);
  }
  return JSON.parse(body);
}

function columnSummary(result) {
  const fields = Array.isArray(result?.fields) ? result.fields : [];
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  if (fields.length > 0 && rows.length > 0 && Array.isArray(rows[0])) {
    const nameIndex = fields.findIndex((field) => field.name === "column_name");
    const typeIndex = fields.findIndex((field) => field.name === "data_type");
    return rows
      .map((row) => `${row[nameIndex]} ${row[typeIndex]}`)
      .join(", ");
  }
  return rows
    .map((row) => `${row.column_name} ${row.data_type}`)
    .join(", ");
}

/** Applies db/<table>.sql and prints the resulting columns, or skips with no database. */
export async function applySchema(table, file = `${table}.sql`) {
  if (!/^[a-z_]+$/.test(table)) {
    throw new Error(`Refusing to inspect an unexpected table name: ${table}`);
  }

  const connectionString = schemaDatabaseUrl();
  if (!connectionString) {
    console.log(`${table} table: skipped (DATABASE_URL is not set)`);
    return;
  }

  try {
    await neonQuery(connectionString, statementForNeon(schemaSql(file)));
    const columns = await neonQuery(
      connectionString,
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${table}' ORDER BY ordinal_position`,
    );
    console.log(`${table} table: ${columnSummary(columns)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${table} table: failed to apply db/${file}`);
    console.error(message.replaceAll(connectionString, "[redacted]"));
    process.exitCode = 1;
  }
}
