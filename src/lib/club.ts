/**
 * Redline Club rules. Pure arithmetic and validation only — no database, no
 * `server-only` — so the API routes, the pages and the unit tests can all
 * import it. Balances are money: every number a customer could influence is
 * recomputed here from server-held values, never trusted from the client.
 *
 * Tier names, spend thresholds, earning rates and the points-to-dollars
 * conversion have NOT been approved. They are therefore `null` in
 * `CLUB_PROGRAM` below, and while any of them is missing or invalid the
 * programme is inactive: nothing is earned and nothing can be redeemed. See
 * docs/redline-club.md for the decisions that are still needed.
 */

/** Points are redeemed in whole blocks of this size. */
export const REDEEM_STEP_POINTS = 100;

/** An order never falls below AUD $1 payable, so PayID still has something to transfer. */
export const MIN_PAYABLE_CENTS = 100;

export type ClubTierConfig = {
  /** Display name. `null` until approved; the UI shows "Tier N" meanwhile. */
  name: string | null;
  /** Lifetime paid spend, in cents, at which this tier starts. `null` until approved. */
  fromCents: number | null;
  /**
   * Points earned per dollar paid, times 100, so the maths stays in integers
   * (100 = 1 point per dollar). `null` until approved.
   */
  earnBasis: number | null;
};

export type ClubProgramConfig = {
  /**
   * Flip to `true` only in the same change that fills in every value below
   * with figures somebody has signed off. Without it the programme is inactive
   * even if every number happens to be present.
   */
  approved: boolean;
  /** Orders paid before this instant never earn points (including on reconcile). */
  earningStartsAt: string | null;
  /** Dollar value, in cents, of one `REDEEM_STEP_POINTS` block. `null` until approved. */
  centsPerRedeemBlock: number | null;
  /** Exactly four tiers, ordered from entry tier to top tier. */
  tiers: readonly ClubTierConfig[];
};

export const CLUB_TIER_COUNT = 4;

/** The only place the programme is tuned. Deliberately unapproved. */
export const CLUB_PROGRAM: ClubProgramConfig = {
  approved: false,
  earningStartsAt: null,
  centsPerRedeemBlock: null,
  tiers: [
    { name: null, fromCents: null, earnBasis: null },
    { name: null, fromCents: null, earnBasis: null },
    { name: null, fromCents: null, earnBasis: null },
    { name: null, fromCents: null, earnBasis: null },
  ],
};

export type ClubTier = {
  id: string;
  name: string;
  fromCents: number;
  earnBasis: number;
};

export type ActiveClubProgram = {
  tiers: readonly ClubTier[];
  centsPerRedeemBlock: number;
  earningStartsAt: Date;
};

export type ClubProgramValidation =
  | { ok: true; program: ActiveClubProgram }
  | { ok: false; problems: string[] };

function isWholeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Checks a configuration and, only if it is complete and approved, returns the
 * fully typed programme. Every problem is listed so a deploy log says exactly
 * which decision is missing.
 */
export function validateClubProgram(config: ClubProgramConfig): ClubProgramValidation {
  const problems: string[] = [];
  if (!config.approved) problems.push("programme is not marked approved");

  if (!isWholeNumber(config.centsPerRedeemBlock) || config.centsPerRedeemBlock <= 0) {
    problems.push("centsPerRedeemBlock must be a positive whole number of cents");
  }

  const startsAt = config.earningStartsAt ? new Date(config.earningStartsAt) : null;
  if (!startsAt || Number.isNaN(startsAt.getTime())) {
    problems.push("earningStartsAt must be a valid ISO date");
  }

  if (config.tiers.length !== CLUB_TIER_COUNT) {
    problems.push(`exactly ${CLUB_TIER_COUNT} tiers are required`);
  }
  const names = new Set<string>();
  let previousFrom = -1;
  config.tiers.forEach((tier, index) => {
    const label = `tier ${index + 1}`;
    const name = tier.name?.trim() ?? "";
    if (!name) problems.push(`${label} needs a name`);
    else if (names.has(name.toLowerCase())) problems.push(`${label} repeats a tier name`);
    names.add(name.toLowerCase());
    if (!isWholeNumber(tier.fromCents) || tier.fromCents < 0) {
      problems.push(`${label} needs a whole-cent spend threshold`);
    } else {
      if (index === 0 && tier.fromCents !== 0) problems.push("tier 1 must start at 0 cents");
      if (tier.fromCents <= previousFrom) problems.push(`${label} threshold must be higher`);
      previousFrom = tier.fromCents;
    }
    if (!isWholeNumber(tier.earnBasis) || tier.earnBasis <= 0) {
      problems.push(`${label} needs a positive earn rate`);
    }
  });

  if (problems.length > 0 || !startsAt) return { ok: false, problems };
  return {
    ok: true,
    program: {
      centsPerRedeemBlock: config.centsPerRedeemBlock as number,
      earningStartsAt: startsAt,
      tiers: config.tiers.map((tier, index) => ({
        id: `tier-${index + 1}`,
        name: (tier.name as string).trim(),
        fromCents: tier.fromCents as number,
        earnBasis: tier.earnBasis as number,
      })),
    },
  };
}

/** `null` while any decision is outstanding: earning and redemption are then off. */
export function activeClubProgram(
  config: ClubProgramConfig = CLUB_PROGRAM,
): ActiveClubProgram | null {
  const result = validateClubProgram(config);
  return result.ok ? result.program : null;
}

/** Precomputed once; safe for client bundles because the config is static. */
export const CLUB_PROGRAM_ACTIVE = activeClubProgram() !== null;

/** What the tier cards show for a tier, with or without approved figures. */
export function tierCardLabel(tier: ClubTierConfig, index: number) {
  return tier.name?.trim() || `Tier ${index + 1}`;
}

export function tierForSpend(program: ActiveClubProgram, lifetimeSpendCents: number): ClubTier {
  const spend = Math.max(0, Math.floor(lifetimeSpendCents || 0));
  let current = program.tiers[0];
  for (const tier of program.tiers) {
    if (spend >= tier.fromCents) current = tier;
  }
  return current;
}

export function nextTier(program: ActiveClubProgram, tier: ClubTier): ClubTier | null {
  const index = program.tiers.findIndex((entry) => entry.id === tier.id);
  return program.tiers[index + 1] ?? null;
}

export type TierProgress = {
  tier: ClubTier;
  next: ClubTier | null;
  /** Cents of further spend needed to reach `next`; 0 at the top tier. */
  remainingCents: number;
  /** 0-100 progress through the current tier band; 100 at the top tier. */
  percent: number;
};

export function tierProgress(program: ActiveClubProgram, lifetimeSpendCents: number): TierProgress {
  const spend = Math.max(0, Math.floor(lifetimeSpendCents || 0));
  const tier = tierForSpend(program, spend);
  const next = nextTier(program, tier);
  if (!next) return { tier, next: null, remainingCents: 0, percent: 100 };
  const band = next.fromCents - tier.fromCents;
  const travelled = spend - tier.fromCents;
  return {
    tier,
    next,
    remainingCents: Math.max(0, next.fromCents - spend),
    percent: band <= 0 ? 100 : Math.min(100, Math.max(0, Math.round((travelled / band) * 100))),
  };
}

/** Dollar value of whole redemption blocks inside `points`. */
export function pointsValueCents(program: ActiveClubProgram, points: number) {
  const blocks = Math.floor(Math.max(0, Math.floor(points || 0)) / REDEEM_STEP_POINTS);
  return blocks * program.centsPerRedeemBlock;
}

/**
 * Points earned on an order, at the tier the member held *before* the order.
 * Earning follows the amount actually paid, so promo codes and redeemed
 * points reduce it. Fractions are dropped once, never compounded.
 */
export function pointsForOrder(tier: ClubTier, paidCents: number) {
  const paid = Math.max(0, Math.floor(paidCents || 0));
  if (paid <= 0) return 0;
  return Math.floor((paid * tier.earnBasis) / 10_000);
}

/** Largest number of points that may be spent on an order of this size. */
export function maxRedeemablePoints(
  program: ActiveClubProgram,
  balancePoints: number,
  payableCents: number,
) {
  const balance = Math.max(0, Math.floor(balancePoints || 0));
  const payable = Math.max(0, Math.floor(payableCents || 0));
  const headroomCents = payable - MIN_PAYABLE_CENTS;
  if (headroomCents < program.centsPerRedeemBlock) return 0;
  const byBalance = Math.floor(balance / REDEEM_STEP_POINTS);
  const byOrder = Math.floor(headroomCents / program.centsPerRedeemBlock);
  return Math.min(byBalance, byOrder) * REDEEM_STEP_POINTS;
}

/**
 * What a redemption request actually costs, after capping it to the member's
 * balance, to whole blocks, and to what the order can absorb. Returns zeros
 * when nothing can be redeemed, so callers never need to special-case it.
 */
export function resolveRedemption(
  program: ActiveClubProgram,
  {
    requestedPoints,
    balancePoints,
    payableCents,
  }: { requestedPoints: number; balancePoints: number; payableCents: number },
) {
  const requested = Math.max(0, Math.floor(requestedPoints || 0));
  const cap = maxRedeemablePoints(program, balancePoints, payableCents);
  const points = Math.min(cap, Math.floor(requested / REDEEM_STEP_POINTS) * REDEEM_STEP_POINTS);
  return { points, discountCents: pointsValueCents(program, points) };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeClubEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase().slice(0, 200);
}

export function isClubEmail(email: string | null | undefined) {
  return EMAIL_PATTERN.test(normalizeClubEmail(email));
}

/** No 0/O, 1/I/L, 2/Z, 5/S, 8/B — codes get read aloud and retyped. */
const CODE_ALPHABET = "ACDEFGHJKMNPQRTUVWXY34679";

/** 25^10 is about 2^46: far beyond what rate-limited online guessing can cover. */
export const MEMBER_CODE_LENGTH = 10;

/** Codes issued before hashing was introduced had six characters. */
const LEGACY_MEMBER_CODE_LENGTH = 6;

export const MEMBER_CODE_PREFIX = "RL-";

function randomValues(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * `RL-XXXXXXXXXX`. Rejection sampling keeps every character equally likely, so
 * the code keeps its full entropy.
 */
export function generateMemberCode(random: (length: number) => Uint8Array = randomValues) {
  const limit = 256 - (256 % CODE_ALPHABET.length);
  let code = "";
  while (code.length < MEMBER_CODE_LENGTH) {
    for (const byte of random(MEMBER_CODE_LENGTH)) {
      if (byte >= limit) continue;
      code += CODE_ALPHABET[byte % CODE_ALPHABET.length];
      if (code.length === MEMBER_CODE_LENGTH) break;
    }
  }
  return `${MEMBER_CODE_PREFIX}${code}`;
}

/** Accepts the code with or without the prefix, spaces, dashes or lower case. */
export function normalizeMemberCode(input: string | null | undefined) {
  const cleaned = (input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16);
  const body = cleaned.startsWith("RL") ? cleaned.slice(2) : cleaned;
  if (body.length !== MEMBER_CODE_LENGTH && body.length !== LEGACY_MEMBER_CODE_LENGTH) return "";
  if (![...body].every((character) => CODE_ALPHABET.includes(character))) return "";
  return `${MEMBER_CODE_PREFIX}${body}`;
}

export function formatPoints(points: number) {
  return Math.max(0, Math.floor(points || 0)).toLocaleString("en-AU");
}

export function formatCents(cents: number) {
  const amount = Math.max(0, Math.floor(cents || 0)) / 100;
  return amount.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
  });
}

/** Label for the discount line on every surface that shows one. */
export const CLUB_DISCOUNT_LABEL = "Club points";

/** `Club points −$5.00`, the single wording used at checkout, on orders, in admin and in email. */
export function clubDiscountText(discountCents: number) {
  return `${CLUB_DISCOUNT_LABEL} −${formatCents(discountCents)}`;
}
