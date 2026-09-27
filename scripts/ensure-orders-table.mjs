import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { applySchema, schemaSql } from "./neon-schema.mjs";

export function ordersSchemaSql() {
  return schemaSql("orders.sql");
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  await applySchema("orders");
}
