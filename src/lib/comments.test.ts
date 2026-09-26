import assert from "node:assert/strict";
import test from "node:test";
import {
  formatCommentTime,
  insertComment,
  listComments,
  parseComment,
  type Sql,
} from "./comments.ts";

test("parseComment trims text and rejects empty or oversized values", () => {
  assert.deepEqual(parseComment("  hello  "), { ok: true, comment: "hello" });
  assert.deepEqual(parseComment("   "), { ok: false, error: "Write a comment." });
  assert.deepEqual(parseComment(null), { ok: false, error: "Write a comment." });
  assert.deepEqual(parseComment(new File(["x"], "x.txt")), {
    ok: false,
    error: "Write a comment.",
  });
  assert.equal(parseComment(`${"a".repeat(500)}`).ok, true);
  assert.equal(parseComment("a".repeat(501)).ok, false);
});

test("parseComment strips null bytes before saving", () => {
  assert.deepEqual(parseComment("hel\0lo"), { ok: true, comment: "hello" });
});

test("insertComment binds the comment as a parameter", async () => {
  const calls: Array<{ query: string; params?: unknown[] }> = [];
  const sql: Sql = {
    query: async (query, params) => {
      calls.push({ query, params });
      return [];
    },
  };
  const payload = "'); DROP TABLE comments; --";
  await insertComment(payload, sql);
  assert.match(calls[0]?.query ?? "", /CREATE TABLE IF NOT EXISTS comments/);
  assert.equal(calls[1]?.query, "INSERT INTO comments (comment) VALUES ($1)");
  assert.deepEqual(calls[1]?.params, [payload]);
  assert.equal(calls[1]?.query.includes(payload), false);
});

test("listComments maps rows and reports a missing database", async () => {
  assert.deepEqual(await listComments(null), {
    comments: [],
    configured: false,
    error: null,
  });

  const sql: Sql = {
    query: async (query) => {
      if (query.startsWith("SELECT")) {
        return [
          { id: 4, comment: "stored", created_at: "2026-09-26T06:30:00.000Z" },
          { id: "skip" },
        ];
      }
      return [];
    },
  };
  const listed = await listComments(sql);
  assert.equal(listed.configured, true);
  assert.equal(listed.error, null);
  assert.deepEqual(listed.comments, [
    { id: "4", comment: "stored", createdAt: "2026-09-26T06:30:00.000Z" },
  ]);
});

test("formatCommentTime uses an Australia/Sydney clock", () => {
  assert.equal(formatCommentTime("not-a-date"), "");
  assert.match(formatCommentTime("2026-09-26T06:30:00.000Z"), /26 Sept 2026/);
  assert.match(formatCommentTime("2026-09-26T06:30:00.000Z"), /4:30 pm/);
});
