import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUB_TIERS,
  MEMBER_CODE_PREFIX,
  REDEEM_STEP_POINTS,
  generateMemberCode,
  maxRedeemablePoints,
  normalizeMemberCode,
  percentBack,
  pointsForOrder,
  pointsValueCents,
  resolveRedemption,
  tierForSpend,
  tierProgress,
} from "./club.ts";

test("tiers return the advertised percentage back", () => {
  assert.deepEqual(
    CLUB_TIERS.map((tier) => [tier.name, percentBack(tier)]),
    [
      ["Member", 5],
      ["Silver", 6.25],
      ["Gold", 7.5],
      ["VIP", 10],
    ],
  );
});

test("tier is set by lifetime spend, at the threshold and below it", () => {
  assert.equal(tierForSpend(0).id, "member");
  assert.equal(tierForSpend(49_999).id, "member");
  assert.equal(tierForSpend(50_000).id, "silver");
  assert.equal(tierForSpend(99_999).id, "silver");
  assert.equal(tierForSpend(100_000).id, "gold");
  assert.equal(tierForSpend(149_999).id, "gold");
  assert.equal(tierForSpend(150_000).id, "vip");
  assert.equal(tierForSpend(10_000_000).id, "vip");
  assert.equal(tierForSpend(-500).id, "member");
});

test("progress reports the spend still needed for the next tier", () => {
  const silver = tierProgress(75_000);
  assert.equal(silver.tier.id, "silver");
  assert.equal(silver.next?.id, "gold");
  assert.equal(silver.remainingCents, 25_000);
  assert.equal(silver.percent, 50);

  const vip = tierProgress(900_000);
  assert.equal(vip.next, null);
  assert.equal(vip.remainingCents, 0);
  assert.equal(vip.percent, 100);
});

test("points are earned at the tier rate on the amount paid", () => {
  assert.equal(pointsForOrder(10_000, CLUB_TIERS[0]), 100);
  assert.equal(pointsForOrder(10_000, CLUB_TIERS[1]), 125);
  assert.equal(pointsForOrder(10_000, CLUB_TIERS[2]), 150);
  assert.equal(pointsForOrder(10_000, CLUB_TIERS[3]), 200);
  // Part dollars round down, once, in the store's favour.
  assert.equal(pointsForOrder(10_099, CLUB_TIERS[0]), 100);
  assert.equal(pointsForOrder(0, CLUB_TIERS[3]), 0);
  assert.equal(pointsForOrder(-10_000, CLUB_TIERS[0]), 0);
});

test("100 points is worth five dollars", () => {
  assert.equal(pointsValueCents(100), 500);
  assert.equal(pointsValueCents(0), 0);
  assert.equal(pointsValueCents(-100), 0);
});

test("redemption is capped by balance, by whole blocks and by the order", () => {
  // Balance is the binding limit.
  assert.equal(maxRedeemablePoints(250, 50_000), 200);
  // Order size is the binding limit: $20 order can absorb $19 of points.
  assert.equal(maxRedeemablePoints(10_000, 2_000), 300);
  // An order must keep at least $1 payable.
  assert.equal(maxRedeemablePoints(10_000, 500), 0);
  assert.equal(maxRedeemablePoints(99, 50_000), 0);
});

test("a redemption request is re-capped rather than trusted", () => {
  assert.deepEqual(
    resolveRedemption({ requestedPoints: 1_000, balancePoints: 450, payableCents: 50_000 }),
    { points: 400, discountCents: 2_000 },
  );
  // Odd requests fall back to whole blocks.
  assert.deepEqual(
    resolveRedemption({ requestedPoints: 150, balancePoints: 10_000, payableCents: 50_000 }),
    { points: 100, discountCents: 500 },
  );
  // Negative and absurd inputs are harmless.
  assert.deepEqual(
    resolveRedemption({ requestedPoints: -5, balancePoints: 10_000, payableCents: 50_000 }),
    { points: 0, discountCents: 0 },
  );
  assert.deepEqual(
    resolveRedemption({
      requestedPoints: Number.MAX_SAFE_INTEGER,
      balancePoints: 10_000,
      payableCents: 1_000,
    }),
    { points: 100, discountCents: 500 },
  );
});

test("redeeming never takes an order below a dollar", () => {
  for (const payable of [100, 599, 600, 1_000, 2_500]) {
    const { discountCents } = resolveRedemption({
      requestedPoints: 100_000,
      balancePoints: 100_000,
      payableCents: payable,
    });
    assert.ok(payable - discountCents >= 100, `order of ${payable} kept ${payable - discountCents}`);
  }
});

test("member codes are prefixed, readable and stable under normalisation", () => {
  const code = generateMemberCode();
  assert.match(code, /^RL-[ACDEFGHJKMNPQRTUVWXY34679]{6}$/);
  assert.equal(normalizeMemberCode(code.toLowerCase()), code);
  assert.equal(normalizeMemberCode(code.slice(MEMBER_CODE_PREFIX.length)), code);
  assert.equal(normalizeMemberCode(` ${code.toLowerCase()} `), code);
  assert.equal(normalizeMemberCode("RL-ABC"), "");
  assert.equal(normalizeMemberCode("RL-OOOOOO"), "");
  assert.equal(normalizeMemberCode(null), "");
});

test("generated codes use the whole alphabet without bias leaks", () => {
  const codes = new Set(Array.from({ length: 200 }, () => generateMemberCode()));
  assert.ok(codes.size > 190, `expected mostly unique codes, got ${codes.size}`);
});

test("the redemption step is the block size the UI offers", () => {
  assert.equal(REDEEM_STEP_POINTS, 100);
});
