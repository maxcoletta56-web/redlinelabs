import { neon } from "@neondatabase/serverless";

export type Sql = {
  query: (query: string, params?: unknown[]) => Promise<unknown>;
};

let cached: { url: string; sql: Sql } | null = null;

export function getSql(): Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (cached?.url === url) return cached.sql;
  const client = neon(url);
  const sql: Sql = {
    query: (query, params) => client.query(query, params ?? []),
  };
  cached = { url, sql };
  return sql;
}

export function rowsOf(result: unknown): unknown[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && Array.isArray((result as { rows?: unknown }).rows)) {
    return (result as { rows: unknown[] }).rows;
  }
  return [];
}

const ready = new WeakMap<Sql, Map<string, Promise<void>>>();

/** Runs a `CREATE TABLE IF NOT EXISTS` at most once per client per process. */
export function ensureTable(sql: Sql, name: string, createStatement: string) {
  let perClient = ready.get(sql);
  if (!perClient) {
    perClient = new Map();
    ready.set(sql, perClient);
  }
  let pending = perClient.get(name);
  if (!pending) {
    pending = sql
      .query(createStatement)
      .then(() => undefined)
      .catch((error: unknown) => {
        perClient?.delete(name);
        throw error;
      });
    perClient.set(name, pending);
  }
  return pending;
}
