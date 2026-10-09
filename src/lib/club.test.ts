import assert from "node:assert/strict";
import test from "node:test";
import {
  CLUB_PROGRAM,
  CLUB_PROGRAM_ACTIVE,
  MEMBER_CODE_PREFIX,
  MIN_PAYABLE_CENTS,
  REDEEM_STEP_POINTS,
  activeClubProgram,
  clubDiscountText,
  formatCents,
  generateMemberCode,
  maxRedeemablePoints,
  normalizeMemberCode,
  pointsForOrder,
  pointsValueCents,
  resolveRedemption,
  tierCardLabel,
  tierForSpend,
  tierProgress,
  validateClubProgram,
  type ClubProgramConfig,
} from "./club.ts";
import { TEST_PROGRAM, TEST_PROGRAM_CONFIG } from "./club-test-fixtures.ts";

const [A, B, C, D] = TEST_PROGRAM.tiers;

test("the shipped programme has confirmed tiers but is still unapproved and inactive", () => {
  assert.equal(CLUB_PROGRAM.approved, false);
  assert.equal(CLUB_PROGRAM_ACTIVE, false);
  assert.equal(activeClubProgram(), null);
  assert.deepEqual(
    CLUB_PROGRAM.tiers.map((tier) => [tier.name, tier.fromCents]),
    [
      ["Member", 0],
      ["Silver", 50_000],
      ["Gold", 100_000],
      ["VIP", 200_000],
    ],
  );
  // Nothing unconfirmed is filled in.
  for (const tier of CLUB_PROGRAM.tiers) assert.equal(tier.earnBasis, null);
  assert.equal(CLUB_PROGRAM.centsPerRedeemBlock, null);
  assert.equal(CLUB_PROGRAM.earningStartsAt, null);
});

test("confirmed tiers alone do not activate the programme, even if marked approved", () => {
  const result = validateClubProgram({ ...CLUB_PROGRAM, approved: true });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.ok(result.problems.some((p) => /earn rate/.test(p)));
    assert.ok(result.problems.some((p) => /centsPerRedeemBlock/.test(p)));
    assert.ok(result.problems.some((p) => /earningStartsAt/.test(p)));
    assert.ok(!result.problems.some((p) => /name|threshold|start at 0/.test(p)));
  }
});

test("the confirmed thresholds select the right tier at and just below each boundary", () => {
  const withRates = activeClubProgram({
    ...CLUB_PROGRAM,
    approved: true,
    earningStartsAt: "2026-01-01T00:00:00Z",
    centsPerRedeemBlock: 500,
    tiers: CLUB_PROGRAM.tiers.map((tier) => ({ ...tier, earnBasis: 100 })),
  });
  assert.ok(withRates);
  if (!withRates) return;
  const cases: [number, string][] = [
    [0, "Member"],
    [49_999, "Member"],
    [50_000, "Silver"],
    [99_999, "Silver"],
    [100_000, "Gold"],
    [199_999, "Gold"],
    [200_000, "VIP"],
    [10_000_000, "VIP"],
  ];
  for (const [spend, name] of cases) assert.equal(tierForSpend(withRates, spend).name, name, `${spend}`);
  assert.equal(tierProgress(withRates, 49_999).remainingCents, 1);
  assert.equal(tierProgress(withRates, 199_999).remainingCents, 1);
});


test("a complete, approved configuration validates", () => {
  const result = validateClubProgram(TEST_PROGRAM_CONFIG);
  assert.equal(result.ok, true);
});

test("each way a configuration can be wrong is reported", () => {
  const withTiers = (tiers: ClubProgramConfig["tiers"]): ClubProgramConfig => ({
    ...TEST_PROGRAM_CONFIG,
    tiers,
  });
  const tiers = TEST_PROGRAM_CONFIG.tiers;
  const cases: [string, ClubProgramConfig, RegExp][] = [
    ["unapproved", { ...TEST_PROGRAM_CONFIG, approved: false }, /not marked approved/],
    ["no conversion", { ...TEST_PROGRAM_CONFIG, centsPerRedeemBlock: null }, /centsPerRedeemBlock/],
    ["fractional conversion", { ...TEST_PROGRAM_CONFIG, centsPerRedeemBlock: 12.5 }, /centsPerRedeemBlock/],
    ["bad date", { ...TEST_PROGRAM_CONFIG, earningStartsAt: "soon" }, /earningStartsAt/],
    ["three tiers", withTiers(tiers.slice(0, 3)), /exactly 4/],
    ["tier 1 not zero", withTiers([{ ...tiers[0], fromCents: 100 }, ...tiers.slice(1)]), /tier 1 must start at 0/],
    ["thresholds not ascending", withTiers([tiers[0], tiers[2], tiers[1], tiers[3]]), /must be higher/],
    ["zero rate", withTiers([{ ...tiers[0], earnBasis: 0 }, ...tiers.slice(1)]), /earn rate/],
    ["duplicate name", withTiers([tiers[0], { ...tiers[1], name: "test a" }, ...tiers.slice(2)]), /repeats/],
    ["blank name", withTiers([{ ...tiers[0], name: " " }, ...tiers.slice(1)]), /needs a name/],
  ];
  for (const [label, config, pattern] of cases) {
    const result = validateClubProgram(config);
    assert.equal(result.ok, false, label);
    if (!result.ok) assert.ok(result.problems.some((p) => pattern.test(p)), `${label}: ${result.problems}`);
  }
});

test("tier is set by lifetime spend, at the threshold and below it", () => {
  assert.equal(tierForSpend(TEST_PROGRAM, 0), A);
  assert.equal(tierForSpend(TEST_PROGRAM, 9_999), A);
  assert.equal(tierForSpend(TEST_PROGRAM, 10_000), B);
  assert.equal(tierForSpend(TEST_PROGRAM, 20_000), C);
  assert.equal(tierForSpend(TEST_PROGRAM, 10_000_000), D);
  assert.equal(tierForSpend(TEST_PROGRAM, -500), A);
});

test("progress reports the spend still needed for the next tier", () => {
  const mid = tierProgress(TEST_PROGRAM, 15_000);
  assert.equal(mid.tier, B);
  assert.equal(mid.next, C);
  assert.equal(mid.remainingCents, 5_000);
  assert.equal(mid.percent, 50);

  const top = tierProgress(TEST_PROGRAM, 900_000);
  assert.equal(top.next, null);
  assert.equal(top.remainingCents, 0);
  assert.equal(top.percent, 100);
});

test("points are earned at the tier rate on the amount paid, rounding down", () => {
  assert.equal(pointsForOrder(A, 10_000), 100);
  assert.equal(pointsForOrder(B, 10_000), 150);
  assert.equal(pointsForOrder(D, 10_000), 250);
  assert.equal(pointsForOrder(A, 10_099), 100);
  assert.equal(pointsForOrder(A, 0), 0);
  assert.equal(pointsForOrder(A, -10_000), 0);
});

test("points convert to dollars only in whole blocks", () => {
  assert.equal(pointsValueCents(TEST_PROGRAM, 100), 500);
  assert.equal(pointsValueCents(TEST_PROGRAM, 199), 500);
  assert.equal(pointsValueCents(TEST_PROGRAM, 0), 0);
  assert.equal(pointsValueCents(TEST_PROGRAM, -100), 0);
});

test("redemption is capped by balance, by whole blocks and by the order", () => {
  assert.equal(maxRedeemablePoints(TEST_PROGRAM, 250, 50_000), 200);
  // $20 order keeps $1 payable, so $19 of points at $5 a block is 3 blocks.
  assert.equal(maxRedeemablePoints(TEST_PROGRAM, 10_000, 2_000), 300);
  assert.equal(maxRedeemablePoints(TEST_PROGRAM, 10_000, 500), 0);
  assert.equal(maxRedeemablePoints(TEST_PROGRAM, 99, 50_000), 0);
});

test("a redemption request is re-capped, not trusted: multiples of 100 only", () => {
  assert.deepEqual(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: 1_000, balancePoints: 450, payableCents: 50_000 }),
    { points: 400, discountCents: 2_000 },
  );
  assert.deepEqual(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: 150, balancePoints: 10_000, payableCents: 50_000 }),
    { points: 100, discountCents: 500 },
  );
  assert.deepEqual(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: 99, balancePoints: 10_000, payableCents: 50_000 }),
    { points: 0, discountCents: 0 },
  );
  assert.deepEqual(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: -5, balancePoints: 10_000, payableCents: 50_000 }),
    { points: 0, discountCents: 0 },
  );
  assert.deepEqual(
    resolveRedemption(TEST_PROGRAM, {
      requestedPoints: Number.NaN,
      balancePoints: 10_000,
      payableCents: 50_000,
    }),
    { points: 0, discountCents: 0 },
  );
});

test("redeeming never takes an order below AUD $1 payable", () => {
  assert.equal(MIN_PAYABLE_CENTS, 100);
  for (const payable of [100, 599, 600, 601, 1_000, 2_500, 12_345]) {
    const { discountCents } = resolveRedemption(TEST_PROGRAM, {
      requestedPoints: 1_000_000,
      balancePoints: 1_000_000,
      payableCents: payable,
    });
    assert.ok(payable - discountCents >= MIN_PAYABLE_CENTS, `order of ${payable} kept ${payable - discountCents}`);
  }
  // Exactly at the boundary: $6 order, $5 block leaves $1.
  assert.equal(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: 100, balancePoints: 100, payableCents: 600 }).discountCents,
    500,
  );
  assert.equal(
    resolveRedemption(TEST_PROGRAM, { requestedPoints: 100, balancePoints: 100, payableCents: 599 }).discountCents,
    0,
  );
});

test("member codes are prefixed, long and stable under normalisation", () => {
  const code = generateMemberCode();
  assert.match(code, /^RL-[ACDEFGHJKMNPQRTUVWXY34679]{10}$/);
  assert.equal(normalizeMemberCode(code.toLowerCase()), code);
  assert.equal(normalizeMemberCode(code.slice(MEMBER_CODE_PREFIX.length)), code);
  assert.equal(normalizeMemberCode(` ${code.toLowerCase()} `), code);
  assert.equal(normalizeMemberCode("RL-ABC"), "");
  assert.equal(normalizeMemberCode("RL-OOOOOOOOOO"), "");
  assert.equal(normalizeMemberCode(null), "");
});

test("generated codes do not repeat", () => {
  const codes = new Set(Array.from({ length: 2_000 }, () => generateMemberCode()));
  assert.equal(codes.size, 2_000);
});

test("the redemption step is the block size the UI offers", () => {
  assert.equal(REDEEM_STEP_POINTS, 100);
});

test("the discount is worded the same everywhere", () => {
  assert.equal(formatCents(500), "$5.00");
  assert.equal(clubDiscountText(500), "Club points −$5.00");
  assert.equal(clubDiscountText(1_250), "Club points −$12.50");
});

test("tier cards fall back to a neutral label only when no name is set", () => {
  assert.equal(tierCardLabel(CLUB_PROGRAM.tiers[1], 1), "Silver");
  assert.equal(tierCardLabel({ name: null, fromCents: null, earnBasis: null }, 1), "Tier 2");
  assert.equal(tierCardLabel(TEST_PROGRAM_CONFIG.tiers[1], 1), "Test B");
});
