import assert from "node:assert/strict";
import test from "node:test";
import {
  authenticateMember,
  awardOrderPoints,
  holdRedemption,
  joinClub,
  readMemberRow,
} from "./club-db.ts";
import type { Sql } from "./db.ts";

type Row = Record<string, unknown>;

function memberRow(overrides: Row = {}): Row {
  return {
    email: "ada@example.com",
    first_name: "Ada",
    member_code: "RL-ACDEFG",
    points_balance: 100,
    lifetime_spend_cents: 0,
    first_order_bonus_at: null,
    created_at: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

/** Routes each statement to a canned result and records what was asked. */
function fakeSql(handler: (query: string, params: unknown[]) => unknown) {
  const calls: { query: string; params: unknown[] }[] = [];
  const sql: Sql = {
    query: async (query, params = []) => {
      calls.push({ query, params });
      return handler(query, params) ?? [];
    },
  };
  return { sql, calls };
}

function statement(calls: { query: string }[], fragment: string) {
  return calls.filter((call) => call.query.includes(fragment));
}

test("readMemberRow maps a database row and drops a row with no email", () => {
  const member = readMemberRow(memberRow({ points_balance: "250" }));
  assert.equal(member?.email, "ada@example.com");
  assert.equal(member?.pointsBalance, 250);
  assert.equal(readMemberRow({ email: "" }), null);
  assert.equal(readMemberRow(null), null);
});

test("joining creates the member with welcome points and a ledger entry", async () => {
  const { sql, calls } = fakeSql((query) =>
    query.startsWith("INSERT INTO club_members") ? [memberRow()] : [],
  );
  const result = await joinClub({ email: " Ada@Example.com ", firstName: " Ada " }, sql, () => "RL-ACDEFG");

  assert.equal(result.created, true);
  assert.equal(result.member.email, "ada@example.com");
  const insert = statement(calls, "INSERT INTO club_members")[0];
  assert.deepEqual(insert.params, ["ada@example.com", "Ada", "RL-ACDEFG", 100]);
  const ledger = statement(calls, "INSERT INTO club_points_ledger")[0];
  assert.deepEqual(ledger.params, ["ada@example.com", 100, "join", null, "Welcome points"]);
});

test("joining twice returns the existing member and adds no second bonus", async () => {
  const { sql, calls } = fakeSql((query) =>
    query.startsWith("SELECT") && query.includes("club_members") ? [memberRow()] : [],
  );
  const result = await joinClub({ email: "ada@example.com" }, sql, () => "RL-ACDEFG");

  assert.equal(result.created, false);
  assert.equal(statement(calls, "INSERT INTO club_points_ledger").length, 0);
});

test("joining rejects an invalid email before touching the database", async () => {
  const { sql, calls } = fakeSql(() => []);
  await assert.rejects(() => joinClub({ email: "not-an-email" }, sql), /valid email/);
  assert.equal(calls.length, 0);
});

test("authentication needs the right code, in any case or format", async () => {
  const { sql } = fakeSql((query) => (query.startsWith("SELECT") ? [memberRow()] : []));
  assert.ok(await authenticateMember("ada@example.com", "rl-acdefg", sql));
  assert.ok(await authenticateMember("ada@example.com", "ACDEFG", sql));
  assert.equal(await authenticateMember("ada@example.com", "RL-ACDEFH", sql), null);
  assert.equal(await authenticateMember("ada@example.com", "", sql), null);
});

test("holding points spends them conditionally and logs the debit", async () => {
  const { sql, calls } = fakeSql((query) => {
    if (query.startsWith("UPDATE club_members SET points_balance = points_balance - ")) {
      return [memberRow({ points_balance: 100 })];
    }
    if (query.startsWith("INSERT INTO club_points_ledger")) return [{ id: 7 }];
    return [];
  });
  const hold = await holdRedemption({ email: "ada@example.com", points: 300 }, sql);

  assert.equal(hold?.points, 300);
  assert.equal(hold?.ledgerId, 7);
  const spend = statement(calls, "points_balance - $2")[0];
  assert.match(spend.query, /points_balance >= \$2/);
  assert.deepEqual(spend.params, ["ada@example.com", 300]);
});

test("holding returns nothing when the balance no longer covers the request", async () => {
  const { sql, calls } = fakeSql(() => []);
  assert.equal(await holdRedemption({ email: "ada@example.com", points: 300 }, sql), null);
  assert.equal(statement(calls, "INSERT INTO club_points_ledger").length, 0);
});

test("a paid order earns at the tier held before the order, plus the first-order bonus", async () => {
  const { sql, calls } = fakeSql((query, params) => {
    if (query.startsWith("SELECT") && query.includes("club_members")) {
      return [memberRow({ lifetime_spend_cents: 60_000, points_balance: 0 })];
    }
    if (query.startsWith("INSERT INTO club_points_ledger")) return [{ id: 1 }];
    if (query.includes("first_order_bonus_at = now()")) {
      return [memberRow({ first_order_bonus_at: "2026-10-02T00:00:00Z" })];
    }
    if (query.includes("points_balance + $2")) return [memberRow({ points_balance: Number(params[1]) })];
    return [];
  });

  const award = await awardOrderPoints(
    { email: "ada@example.com", orderReference: "RL-AAA111", paidCents: 20_000 },
    sql,
  );

  // Silver: 1.25 points per dollar on $200 paid.
  assert.equal(award?.orderPoints, 250);
  assert.equal(award?.bonusPoints, 100);
  const earn = statement(calls, "INSERT INTO club_points_ledger")[0];
  assert.deepEqual(earn.params, ["ada@example.com", 250, "order", "RL-AAA111", "Silver earn rate"]);
  const spend = statement(calls, "points_balance + $2")[0];
  assert.deepEqual(spend.params, ["ada@example.com", 250, 20_000]);
});

test("marking the same order paid twice awards nothing the second time", async () => {
  // The unique index makes the ledger insert return no row on a repeat.
  const { sql, calls } = fakeSql((query) =>
    query.startsWith("SELECT") && query.includes("club_members") ? [memberRow()] : [],
  );
  const award = await awardOrderPoints(
    { email: "ada@example.com", orderReference: "RL-AAA111", paidCents: 20_000 },
    sql,
  );

  assert.equal(award, null);
  assert.equal(statement(calls, "points_balance + $2").length, 0);
  assert.equal(statement(calls, "first_order_bonus_at = now()").length, 0);
});

test("an order from a non-member is ignored", async () => {
  const { sql, calls } = fakeSql(() => []);
  assert.equal(
    await awardOrderPoints(
      { email: "stranger@example.com", orderReference: "RL-AAA111", paidCents: 20_000 },
      sql,
    ),
    null,
  );
  assert.equal(statement(calls, "INSERT INTO club_points_ledger").length, 0);
});
