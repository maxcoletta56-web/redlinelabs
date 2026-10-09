import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKFILL_ORDER_DISCOUNTS,
  clubStatements,
  ensureClubTables,
  hashLegacyCode,
  normalizeLegacyCode,
} from "../../scripts/ensure-club-tables.mjs";
import { hashMemberCode } from "./club-db.ts";
import { normalizeMemberCode } from "./club.ts";
import { TEST_SECRET } from "./club-test-fixtures.ts";

type Call = { sql: string; params?: unknown[] };

function run(legacy: { email: string; member_code: string }[], secret: string) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const errors: string[] = [];
  const query = async (sql: string, params?: unknown[]) => {
    calls.push({ sql, params });
    if (sql.startsWith("SELECT email, member_code")) return { rows: legacy };
    return { rows: [] };
  };
  return {
    calls,
    logs,
    errors,
    done: () =>
      ensureClubTables({
        connectionString: "******example.neon.tech/db",
        query,
        secret,
        log: (m: string) => logs.push(m),
        logError: (m: string) => errors.push(m),
      }),
  };
}

test("the migration is single statements Neon accepts", () => {
  const statements = clubStatements();
  assert.ok(statements.length >= 5);
  for (const statement of statements) {
    assert.equal(statement.endsWith(";"), false);
    assert.equal(statement.split(";").length, 1);
  }
});

test("legacy codes hash to exactly what authentication computes", () => {
  for (const legacy of ["RL-ACDEFG", "rl-acdefg", " acdefg "]) {
    assert.equal(normalizeLegacyCode(legacy), normalizeMemberCode(legacy) || "RL-ACDEFG");
    assert.equal(hashLegacyCode(legacy, TEST_SECRET), hashMemberCode("RL-ACDEFG", TEST_SECRET));
  }
});

test("plaintext codes are hashed and erased, and the run is idempotent in shape", async () => {
  const job = run([{ email: "ada@example.com", member_code: "RL-ACDEFG" }], TEST_SECRET);
  assert.equal(await job.done(), true);

  const update = job.calls.find((c) => c.sql.startsWith("UPDATE club_members SET member_code_hash"));
  assert.deepEqual(update?.params, ["ada@example.com", hashMemberCode("RL-ACDEFG", TEST_SECRET)]);
  assert.match(update?.sql ?? "", /member_code = NULL/);
  assert.ok(!JSON.stringify(job.calls.map((c) => c.params)).includes("RL-ACDEFG"));
  assert.ok(job.calls.some((c) => c.sql === BACKFILL_ORDER_DISCOUNTS));
  assert.ok(job.calls.some((c) => c.sql.startsWith("UPDATE club_members SET member_code = NULL WHERE member_code IS NOT NULL")));
});

test("plaintext codes with no secret fail the step instead of shipping them", async () => {
  const job = run([{ email: "ada@example.com", member_code: "RL-ACDEFG" }], "");
  assert.equal(await job.done(), false);
  assert.match(job.errors.join("\n"), /CLUB_CODE_SECRET/);
  assert.ok(!job.calls.some((c) => c.sql.startsWith("UPDATE club_members SET member_code_hash")));
});

test("no legacy codes means no secret is needed", async () => {
  const job = run([], "");
  assert.equal(await job.done(), true);
});

test("without a database url the step is skipped", async () => {
  const logs: string[] = [];
  assert.equal(await ensureClubTables({ connectionString: "", log: (m: string) => logs.push(m) }), true);
  assert.match(logs.join(), /skipped/);
});
