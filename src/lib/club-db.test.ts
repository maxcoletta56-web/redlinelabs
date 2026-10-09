import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AWARD_ORDER_POINTS,
  CREATE_CLUB_LEDGER,
  CREATE_CLUB_MEMBERS,
  CREATE_CLUB_LEDGER_INDEX,
  ClubUnavailableError,
  RESERVE_POINTS,
  RELEASE_POINTS,
  adjustPoints,
  authenticateMember,
  awardOrderPoints,
  clubCodeSecret,
  findMember,
  hashMemberCode,
  joinClub,
  reconcileClub,
  releaseRedemption,
  reserveRedemption,
} from "./club-db.ts";
import { createFakeClubSql, TEST_PROGRAM, TEST_SECRET } from "./club-test-fixtures.ts";

const ADA = "ada@example.com";

test("the code secret must be present and long enough", () => {
  assert.throws(() => clubCodeSecret({}), ClubUnavailableError);
  assert.throws(() => clubCodeSecret({ CLUB_CODE_SECRET: "short" }), ClubUnavailableError);
  assert.equal(clubCodeSecret({ CLUB_CODE_SECRET: TEST_SECRET }), TEST_SECRET);
});

test("codes are hashed with a keyed hash, not stored or hashed plainly", () => {
  const hash = hashMemberCode("RL-ACDEFGHJKM", TEST_SECRET);
  assert.match(hash ?? "", /^[0-9a-f]{64}$/);
  assert.equal(hashMemberCode("rl-acdefghjkm", TEST_SECRET), hash);
  assert.notEqual(hashMemberCode("RL-ACDEFGHJKM", `${TEST_SECRET}!`), hash);
  assert.equal(hashMemberCode("not a code", TEST_SECRET), null);
});

test("the schema guarantees idempotency, hashed codes and non-negative balances", () => {
  assert.match(CREATE_CLUB_MEMBERS, /member_code_hash/);
  // The legacy plaintext column is nullable, only kept so the migration can hash and clear it.
  assert.match(CREATE_CLUB_MEMBERS, /member_code TEXT,/);
  const migration = readFileSync("db/club.sql", "utf8");
  assert.match(migration, /points_balance >= 0/);
  assert.match(migration, /lifetime_spend_cents >= 0/);
  assert.match(migration, /UNIQUE INDEX[^;]*member_code_hash/);
  assert.match(CREATE_CLUB_LEDGER, /REFERENCES club_members/);
  assert.match(CREATE_CLUB_LEDGER_INDEX, /UNIQUE INDEX[\s\S]*\(order_reference, reason\)/);
  assert.match(RESERVE_POINTS, /FOR UPDATE/);
  assert.match(RESERVE_POINTS, /ON CONFLICT DO NOTHING/);
  assert.match(AWARD_ORDER_POINTS, /ON CONFLICT DO NOTHING/);
  assert.match(RELEASE_POINTS, /ON CONFLICT DO NOTHING/);
});

test("joining stores only a hash and returns the code once", async () => {
  const db = createFakeClubSql();
  const joined = await joinClub({ email: " Ada@Example.com ", firstName: "Ada" }, db.sql, undefined, TEST_SECRET);
  assert.equal(joined.created, true);
  assert.match(joined.memberCode ?? "", /^RL-[A-Z0-9]{10}$/);

  const stored = db.members.get(ADA);
  assert.equal(stored?.hash, hashMemberCode(joined.memberCode ?? "", TEST_SECRET));
  assert.ok(!JSON.stringify([...db.members.values()]).includes(joined.memberCode ?? "x"));
  assert.ok(!JSON.stringify(db.statements).includes(joined.memberCode ?? "x"));
});

test("repeat joining never reveals or replaces the code", async () => {
  const db = createFakeClubSql();
  const first = await joinClub({ email: ADA }, db.sql, undefined, TEST_SECRET);
  const hashBefore = db.members.get(ADA)?.hash;

  const again = await joinClub({ email: "ADA@example.com" }, db.sql, undefined, TEST_SECRET);
  assert.equal(again.created, false);
  assert.equal(again.memberCode, null);
  assert.equal(db.members.get(ADA)?.hash, hashBefore);

  // The original code still works; nothing else does.
  assert.ok(await authenticateMember(ADA, first.memberCode ?? "", db.sql, TEST_SECRET));
  assert.equal(db.members.size, 1);
});

test("concurrent joins for one email create exactly one membership", async () => {
  const db = createFakeClubSql();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => joinClub({ email: ADA }, db.sql, undefined, TEST_SECRET)),
  );
  assert.equal(results.filter((r) => r.created).length, 1);
  assert.equal(results.filter((r) => r.memberCode !== null).length, 1);
});

test("a code hash collision picks a fresh code instead of failing", async () => {
  const db = createFakeClubSql();
  const first = await joinClub({ email: ADA }, db.sql, undefined, TEST_SECRET);
  const codes = [first.memberCode ?? "", "RL-ACDEFGHJKM"];
  const second = await joinClub({ email: "bob@example.com" }, db.sql, () => codes.shift() ?? "", TEST_SECRET);
  assert.equal(second.created, true);
  assert.equal(second.memberCode, "RL-ACDEFGHJKM");
});

test("invalid credentials all give the same null", async () => {
  const db = createFakeClubSql();
  const { memberCode } = await joinClub({ email: ADA }, db.sql, undefined, TEST_SECRET);
  assert.ok(await authenticateMember(ADA, memberCode ?? "", db.sql, TEST_SECRET));
  assert.equal(await authenticateMember(ADA, "RL-AAAAAAAAAA", db.sql, TEST_SECRET), null);
  assert.equal(await authenticateMember("nobody@example.com", memberCode ?? "", db.sql, TEST_SECRET), null);
  assert.equal(await authenticateMember(ADA, "", db.sql, TEST_SECRET), null);
  assert.equal(await authenticateMember("not an email", memberCode ?? "", db.sql, TEST_SECRET), null);
});

test("email alone earns points; a non-member earns nothing", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const award = await awardOrderPoints({ email: "ADA@example.com", orderReference: "RL-AAAAAA", paidCents: 10_000 }, db.sql, TEST_PROGRAM);
  assert.equal(award.status, "awarded");
  assert.equal(db.balance(ADA), 100);
  const stranger = await awardOrderPoints({ email: "x@example.com", orderReference: "RL-BBBBBB", paidCents: 10_000 }, db.sql, TEST_PROGRAM);
  assert.equal(stranger.status, "not_member");
});

test("awarding the same order twice, even at once, moves the balance once", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const input = { email: ADA, orderReference: "RL-AAAAAA", paidCents: 10_000 };
  const results = await Promise.all([1, 2, 3, 4].map(() => awardOrderPoints(input, db.sql, TEST_PROGRAM)));
  assert.equal(results.filter((r) => r.status === "awarded").length, 1);
  assert.equal(results.filter((r) => r.status === "duplicate").length, 3);
  assert.equal(db.balance(ADA), 100);
  assert.equal(db.members.get(ADA)?.spend, 10_000);
  assert.equal(db.ledgerSum(ADA), 100);
});

test("an award uses the tier held before the order and the amount paid", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 0, 10_000);
  const award = await awardOrderPoints({ email: ADA, orderReference: "RL-AAAAAA", paidCents: 10_000 }, db.sql, TEST_PROGRAM);
  assert.equal(award.status === "awarded" && award.points, 150);
});

test("nothing is awarded or spent while the programme is unapproved", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA);
  const award = await awardOrderPoints({ email: ADA, orderReference: "RL-AAAAAA", paidCents: 10_000 }, db.sql, null);
  assert.deepEqual(award, { status: "disabled" });
  assert.equal(db.ledger.length, 0);
});

test("a reservation takes points once per order and refuses an overdraft", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 250);
  const first = await reserveRedemption({ email: ADA, points: 200, orderReference: "RL-AAAAAA" }, db.sql);
  assert.equal(first.status, "reserved");
  assert.equal(db.balance(ADA), 50);

  const repeat = await reserveRedemption({ email: ADA, points: 200, orderReference: "RL-AAAAAA" }, db.sql);
  assert.deepEqual(repeat, { status: "duplicate", points: 200 });
  assert.equal(db.balance(ADA), 50);

  const tooMuch = await reserveRedemption({ email: ADA, points: 100, orderReference: "RL-BBBBBB" }, db.sql);
  assert.deepEqual(tooMuch, { status: "insufficient" });
  assert.equal(db.balance(ADA), 50);
});

test("insufficient balance and empty requests reserve nothing", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 99);
  for (const points of [100, 0, -100]) {
    const result = await reserveRedemption({ email: ADA, points, orderReference: "RL-AAAAAA" }, db.sql);
    assert.equal(result.status, "insufficient");
  }
  assert.equal(db.ledger.length, 0);
});

test("concurrent redemptions can never spend the same points twice", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 200);
  const refs = ["RL-A00001", "RL-A00002", "RL-A00003", "RL-A00004", "RL-A00005"];
  const results = await Promise.all(
    refs.map((orderReference) => reserveRedemption({ email: ADA, points: 100, orderReference }, db.sql)),
  );
  assert.equal(results.filter((r) => r.status === "reserved").length, 2);
  assert.equal(results.filter((r) => r.status === "insufficient").length, 3);
  assert.equal(db.balance(ADA), 0);
  assert.equal(db.ledgerSum(ADA), db.balance(ADA) - 200);
});

test("concurrent requests for one order reserve it once", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 1_000);
  const results = await Promise.all(
    [1, 2, 3].map(() => reserveRedemption({ email: ADA, points: 300, orderReference: "RL-AAAAAA" }, db.sql)),
  );
  assert.deepEqual(results.map((r) => r.status).sort(), ["duplicate", "duplicate", "reserved"]);
  assert.equal(db.balance(ADA), 700);
});

test("releasing a reservation returns the points exactly once", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 300);
  await reserveRedemption({ email: ADA, points: 300, orderReference: "RL-AAAAAA" }, db.sql);
  const results = await Promise.all(
    [1, 2, 3].map(() => releaseRedemption("RL-AAAAAA", "Order cancelled", db.sql)),
  );
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(db.balance(ADA), 300);
  assert.equal(await releaseRedemption("RL-AAAAAA", "again", db.sql), null);
  assert.equal(await releaseRedemption("RL-NEVER1", "none", db.sql), null);
  assert.equal(db.balance(ADA), 300);
});

test("admin adjustments cannot take a balance below zero", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 100);
  assert.equal(await adjustPoints({ email: ADA, points: -200 }, db.sql), null);
  assert.equal((await adjustPoints({ email: ADA, points: -100 }, db.sql))?.pointsBalance, 0);
  assert.equal(await adjustPoints({ email: ADA, points: 0 }, db.sql), null);
  assert.equal((await findMember(ADA, db.sql))?.pointsBalance, 0);
});

test("reconcile retries missed awards and releases, and is safe to repeat", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 100);
  db.orders.push(
    { reference: "RL-P00001", email: ADA, status: "paid", totalCents: 10_000, clubPointsRedeemed: 0, paidAt: "2026-10-02T00:00:00Z" },
    { reference: "RL-P00002", email: "stranger@example.com", status: "paid", totalCents: 10_000, clubPointsRedeemed: 0, paidAt: "2026-10-02T00:00:00Z" },
    { reference: "RL-C00001", email: ADA, status: "cancelled", totalCents: 5_000, clubPointsRedeemed: 100, paidAt: null },
  );
  await reserveRedemption({ email: ADA, points: 100, orderReference: "RL-C00001" }, db.sql);
  assert.equal(db.balance(ADA), 0);

  const first = await reconcileClub({}, db.sql, TEST_PROGRAM);
  assert.deepEqual(first.awardedOrders, ["RL-P00001"]);
  assert.deepEqual(first.releasedOrders, ["RL-C00001"]);
  assert.equal(db.balance(ADA), 200);

  const second = await reconcileClub({}, db.sql, TEST_PROGRAM);
  assert.deepEqual(second.awardedOrders, []);
  assert.deepEqual(second.releasedOrders, []);
  assert.equal(db.balance(ADA), 200);
});

test("reconcile releases reservations whose order was never written, after a grace period", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 100);
  await reserveRedemption({ email: ADA, points: 100, orderReference: "RL-O00001" }, db.sql);
  assert.deepEqual((await reconcileClub({}, db.sql, TEST_PROGRAM)).releasedOrders, []);
  db.age("RL-O00001");
  assert.deepEqual((await reconcileClub({}, db.sql, TEST_PROGRAM)).releasedOrders, ["RL-O00001"]);
  assert.equal(db.balance(ADA), 100);
});

test("reconcile with an unapproved programme still releases but awards nothing", async () => {
  const db = createFakeClubSql();
  db.seedMember(ADA, 100);
  db.orders.push({ reference: "RL-P00001", email: ADA, status: "paid", totalCents: 10_000, clubPointsRedeemed: 0, paidAt: "2026-10-02T00:00:00Z" });
  const summary = await reconcileClub({}, db.sql, null);
  assert.equal(summary.enabled, false);
  assert.deepEqual(summary.awardedOrders, []);
});

test("a missing database reports as unavailable", async () => {
  await assert.rejects(() => findMember(ADA, null), ClubUnavailableError);
});
