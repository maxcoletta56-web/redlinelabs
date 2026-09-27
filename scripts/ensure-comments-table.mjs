import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  applySchema,
  neonQuery,
  neonSqlEndpoint,
  schemaDatabaseUrl,
  schemaSql,
  statementForNeon,
} from "./neon-schema.mjs";

export { neonQuery, neonSqlEndpoint, statementForNeon };

export function commentsSchemaSql() {
  return schemaSql("comments.sql");
}

export function commentsDatabaseUrl(env = process.env) {
  return schemaDatabaseUrl(env);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await applySchema("comments");
}
