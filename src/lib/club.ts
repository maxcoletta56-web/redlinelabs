/**
 * Redline Club rules. Pure arithmetic and validation only — no database, no
 * `server-only` — so the API routes, the pages and the unit tests can all
 * import it. Balances are money: every number a customer could influence is
 * recomputed here from server-held values, never trusted from the client.
 */

/** 100 points = $5.00. */
export const POINT_VALUE_CENTS = 5;

/** Points are redeemed in whole blocks so the discount is always a round dollar. */
export const REDEEM_STEP_POINTS = 100;

/** PayID still needs something to transfer, so an order never falls below $1. */
export const MIN_PAYABLE_CENTS = 100;

export const JOIN_BONUS_POINTS = 100;

export const FIRST_ORDER_BONUS_POINTS = 100;

export type ClubTierId = "member" | "silver" | "gold" | "vip";

export type ClubTier = {
  id: ClubTierId;
  name: string;
  /** Lifetime paid spend, in cents, at which this tier starts. */
  fromCents: number;
  /**
   * Points earned per dollar paid, times 100, so the maths stays in integers:
   * 100 = 1 point per dollar, 125 = 1.25, 200 = 2.
   */
  earnBasis: number;
};

/** Ordered from entry tier to top tier. The only place the programme is tuned. */
export const CLUB_TIERS: readonly ClubTier[] = [
  { id: "member", name: "Member", fromCents: 0, earnBasis: 100 },
  { id: "silver", name: "Silver", fromCents: 50_000, earnBasis: 125 },
  { id: "gold", name: "Gold", fromCents: 100_000, earnBasis: 150 },
  { id: "vip", name: "VIP", fromCents: 150_000, earnBasis: 200 },
] as const;

export const BASE_TIER = CLUB_TIERS[0];

/** Share of spend returned as points, e.g. 5 for the 5% base tier. */
export function percentBack(tier: ClubTier) {
  return (tier.earnBasis * POINT_VALUE_CENTS) / 100;
}

export function tierForSpend(lifetimeSpendCents: number): ClubTier {
  const spend = Math.max(0, Math.floor(lifetimeSpendCents || 0));
  let current = BASE_TIER;
  for (const tier of CLUB_TIERS) {
    if (spend >= tier.fromCents) current = tier;
  }
  return current;
}

export function nextTier(tier: ClubTier): ClubTier | null {
  const index = CLUB_TIERS.findIndex((entry) => entry.id === tier.id);
  return CLUB_TIERS[index + 1] ?? null;
}

export type TierProgress = {
  tier: ClubTier;
  next: ClubTier | null;
  /** Cents of further spend needed to reach `next`; 0 at the top tier. */
  remainingCents: number;
  /** 0-100 progress through the current tier band; 100 at the top tier. */
  percent: number;
};

export function tierProgress(lifetimeSpendCents: number): TierProgress {
  const spend = Math.max(0, Math.floor(lifetimeSpendCents || 0));
  const tier = tierForSpend(spend);
  const next = nextTier(tier);
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

export function pointsValueCents(points: number) {
  return Math.max(0, Math.floor(points || 0)) * POINT_VALUE_CENTS;
}

/**
 * Points earned on an order, at the tier the member held *before* the order.
 * Earning follows the amount actually paid, so promo codes and redeemed
 * points reduce it. Fractions are dropped in the customer's disfavour once,
 * never compounded.
 */
export function pointsForOrder(paidCents: number, tier: ClubTier = BASE_TIER) {
  const paid = Math.max(0, Math.floor(paidCents || 0));
  if (paid <= 0) return 0;
  return Math.floor((paid * tier.earnBasis) / 10_000);
}

/** Largest number of points that may be spent on an order of this size. */
export function maxRedeemablePoints(balancePoints: number, payableCents: number) {
  const balance = Math.max(0, Math.floor(balancePoints || 0));
  const payable = Math.max(0, Math.floor(payableCents || 0));
  if (balance < REDEEM_STEP_POINTS) return 0;
  const headroomCents = payable - MIN_PAYABLE_CENTS;
  if (headroomCents < REDEEM_STEP_POINTS * POINT_VALUE_CENTS) return 0;
  const byBalance = Math.floor(balance / REDEEM_STEP_POINTS);
  const byOrder = Math.floor(headroomCents / (REDEEM_STEP_POINTS * POINT_VALUE_CENTS));
  return Math.min(byBalance, byOrder) * REDEEM_STEP_POINTS;
}

/**
 * What a redemption request actually costs, after capping it to the member's
 * balance, to whole blocks, and to what the order can absorb. Returns zeros
 * when nothing can be redeemed, so callers never need to special-case it.
 */
export function resolveRedemption({
  requestedPoints,
  balancePoints,
  payableCents,
}: {
  requestedPoints: number;
  balancePoints: number;
  payableCents: number;
}) {
  const requested = Math.max(0, Math.floor(requestedPoints || 0));
  const cap = maxRedeemablePoints(balancePoints, payableCents);
  const points = Math.min(cap, Math.floor(requested / REDEEM_STEP_POINTS) * REDEEM_STEP_POINTS);
  return { points, discountCents: pointsValueCents(points) };
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

export const MEMBER_CODE_LENGTH = 6;

export const MEMBER_CODE_PREFIX = "RL-";

function randomValues(length: number) {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * `RL-XXXXXX`. Rejection sampling keeps every character equally likely, so the
 * code keeps its full ~23 bits of entropy.
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
  if (body.length !== MEMBER_CODE_LENGTH) return "";
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
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  });
}

export function formatPointsValue(points: number) {
  return formatCents(pointsValueCents(points));
}
