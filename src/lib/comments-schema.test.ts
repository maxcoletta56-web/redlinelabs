import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import {
  commentsSchemaSql,
  neonQuery,
  neonSqlEndpoint,
  statementForNeon,
} from "../../scripts/ensure-comments-table.mjs";

test("comments schema is the requested table", () => {
  assert.equal(commentsSchemaSql(), "CREATE TABLE IF NOT EXISTS comments (comment TEXT);");
  assert.equal(statementForNeon(commentsSchemaSql()), "CREATE TABLE IF NOT EXISTS comments (comment TEXT)");
});

test("neon sql endpoint uses the direct host", () => {
  const pooled = "postgresql://user:secret@ep-example-pooler.us-east-1.aws.neon.tech/neondb";
  assert.equal(neonSqlEndpoint(pooled), "https://ep-example.us-east-1.aws.neon.tech/sql");
});

test("neon query posts one statement to the sql endpoint", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify({ rows: [] }), { status: 200 });
  };
  const connectionString = "postgresql://user:secret@ep-example.neon.tech/neondb";
  try {
    await neonQuery(connectionString, "CREATE TABLE IF NOT EXISTS comments (comment TEXT)");
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://ep-example.neon.tech/sql");
  const headers = new Headers(calls[0]?.init.headers);
  assert.equal(headers.get("neon-connection-string"), connectionString);
  assert.equal(
    calls[0]?.init.body,
    JSON.stringify({
      query: "CREATE TABLE IF NOT EXISTS comments (comment TEXT)",
      params: [],
    }),
  );
});

test("schema apply skips when no database url is set", () => {
  const result = spawnSync(process.execPath, ["scripts/ensure-comments-table.mjs"], {
    encoding: "utf8",
    env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /comments table: skipped/);
});
