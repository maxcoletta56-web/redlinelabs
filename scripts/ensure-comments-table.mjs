import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const schemaPath = join(dirname(fileURLToPath(import.meta.url)), "../db/comments.sql");
const ordersSchemaPath = join(dirname(fileURLToPath(import.meta.url)), "../db/orders.sql");

export function commentsSchemaSql() {
  return readFileSync(schemaPath, "utf8").trim();
}

export function ordersSchemaStatements() {
  return readFileSync(ordersSchemaPath, "utf8")
    .split(/;\s*\n/)
    .map((statement) => statementForNeon(statement))
    .filter(Boolean);
}

/** Neon’s HTTP SQL endpoint accepts one statement and rejects a trailing semicolon. */
export function statementForNeon(sql) {
  return sql.trim().replace(/;\s*$/, "");
}

export function commentsDatabaseUrl(env = process.env) {
  return env.DATABASE_URL_UNPOOLED || env.DATABASE_URL || "";
}

/** SQL-over-HTTP is served by the direct compute host, not the pooled host. */
export function neonSqlEndpoint(connectionString) {
  const hostname = new URL(connectionString).hostname.replace("-pooler.", ".");
  return `https://${hostname}/sql`;
}

export async function neonQuery(connectionString, query, params = []) {
  const response = await fetch(neonSqlEndpoint(connectionString), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "neon-connection-string": connectionString,
    },
    body: JSON.stringify({ query, params }),
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

async function main() {
  const connectionString = commentsDatabaseUrl();
  if (!connectionString) {
    console.log("comments table: skipped (DATABASE_URL is not set)");
    return;
  }

  try {
    await neonQuery(connectionString, statementForNeon(commentsSchemaSql()));
    for (const statement of ordersSchemaStatements()) {
      await neonQuery(connectionString, statement);
    }
    const columns = await neonQuery(
      connectionString,
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'comments' ORDER BY ordinal_position",
    );
    console.log(`comments table: ${columnSummary(columns)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("comments table: failed to apply db/comments.sql");
    console.error(message.replaceAll(connectionString, "[redacted]"));
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await main();
}
