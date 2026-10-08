import {
  adjustPoints,
  authenticateMember,
  joinClub,
  listLedger,
  listMembers,
  ClubUnavailableError,
  type ClubLedgerEntry,
  type ClubMember,
} from "./club-db.ts";
import {
  JOIN_BONUS_POINTS,
  REDEEM_STEP_POINTS,
  isClubEmail,
  maxRedeemablePoints,
  normalizeClubEmail,
  pointsValueCents,
  tierProgress,
} from "./club.ts";
import { authorizeAdmin } from "./admin-auth.ts";
import { clientKey, rateLimit } from "./rate-limit.ts";

/** Test seams. Production uses the Neon-backed functions above. */
export type ClubApiDeps = {
  joinClub?: typeof joinClub;
  authenticateMember?: typeof authenticateMember;
  listLedger?: typeof listLedger;
  adjustPoints?: typeof adjustPoints;
  listMembers?: typeof listMembers;
  now?: () => number;
};

const UNAVAILABLE = "The club is not available right now. Please try again shortly.";

const JOIN_LIMIT = { limit: 5, windowMs: 60_000 };
const BALANCE_LIMIT = { limit: 10, windowMs: 60_000 };

function unavailable() {
  return Response.json({ error: UNAVAILABLE }, { status: 503 });
}

function tooMany(retryAfterMs: number) {
  return Response.json(
    { error: "Too many attempts. Please wait a moment and try again." },
    { status: 429, headers: { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const json: unknown = await request.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) return null;
    return json as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function memberSummary(member: ClubMember) {
  const progress = tierProgress(member.lifetimeSpendCents);
  return {
    firstName: member.firstName,
    tier: progress.tier.name,
    tierId: progress.tier.id,
    points: member.pointsBalance,
    pointsValueCents: pointsValueCents(member.pointsBalance),
    lifetimeSpendCents: member.lifetimeSpendCents,
    nextTier: progress.next?.name ?? null,
    nextTierRemainingCents: progress.remainingCents,
    tierProgressPercent: progress.percent,
  };
}

function ledgerSummary(entries: ClubLedgerEntry[]) {
  return entries.map((entry) => ({
    points: entry.points,
    reason: entry.reason,
    orderReference: entry.orderReference,
    note: entry.note,
    createdAt: entry.createdAt,
  }));
}

/**
 * Joining returns the member code **only** to a browser that just created the
 * membership. An email that is already a member gets the same shaped, neutral
 * answer, so the endpoint cannot be used to discover who is a customer.
 */
export async function clubJoinPost(request: Request, deps: ClubApiDeps = {}): Promise<Response> {
  const limit = rateLimit(`club-join:${clientKey(request)}`, JOIN_LIMIT.limit, JOIN_LIMIT.windowMs);
  if (!limit.ok) return tooMany(limit.retryAfterMs);

  const body = await readBody(request);
  const email = normalizeClubEmail(readString(body?.email));
  if (!isClubEmail(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const firstName = readString(body?.firstName).slice(0, 120);

  try {
    const { member, created } = await (deps.joinClub ?? joinClub)({ email, firstName });
    if (!created) {
      return Response.json({
        created: false,
        points: null,
        memberCode: null,
        message:
          "That email is already in the club. Open the balance page and use the member code from your welcome message.",
      });
    }
    return Response.json({
      created: true,
      points: JOIN_BONUS_POINTS,
      pointsValueCents: pointsValueCents(JOIN_BONUS_POINTS),
      memberCode: member.memberCode,
      message: "You are in. Keep your member code — it is how you check and spend points.",
    });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    console.error("[club] join failed", {
      emailDomain: email.split("@")[1] ?? "unknown",
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: "Could not create the membership" }, { status: 502 });
  }
}

export async function clubBalancePost(
  request: Request,
  deps: ClubApiDeps = {},
): Promise<Response> {
  const limit = rateLimit(
    `club-balance:${clientKey(request)}`,
    BALANCE_LIMIT.limit,
    BALANCE_LIMIT.windowMs,
  );
  if (!limit.ok) return tooMany(limit.retryAfterMs);

  const body = await readBody(request);
  const email = normalizeClubEmail(readString(body?.email));
  const code = readString(body?.code);
  if (!isClubEmail(email) || !code) {
    return Response.json({ error: "Enter your email and member code" }, { status: 400 });
  }

  try {
    const member = await (deps.authenticateMember ?? authenticateMember)(email, code);
    if (!member) {
      // One message for both "no such member" and "wrong code" — no enumeration.
      return Response.json(
        { error: "That email and member code do not match a membership" },
        { status: 404 },
      );
    }
    const ledger = await (deps.listLedger ?? listLedger)(member.email, 20);
    return Response.json({ member: memberSummary(member), ledger: ledgerSummary(ledger) });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    console.error("[club] balance lookup failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: "Could not read that balance" }, { status: 502 });
  }
}

/**
 * What the cart asks before showing the redemption row: who the member is and
 * the most they could spend on a cart of this size. The number the customer
 * then submits is re-capped server-side at order creation — this is a display
 * helper, never the authority.
 */
export async function clubQuotePost(request: Request, deps: ClubApiDeps = {}): Promise<Response> {
  const limit = rateLimit(
    `club-quote:${clientKey(request)}`,
    BALANCE_LIMIT.limit,
    BALANCE_LIMIT.windowMs,
  );
  if (!limit.ok) return tooMany(limit.retryAfterMs);

  const body = await readBody(request);
  const email = normalizeClubEmail(readString(body?.email));
  const code = readString(body?.code);
  const payableCents = Math.max(0, Math.trunc(Number(body?.payableCents)) || 0);
  if (!isClubEmail(email) || !code) {
    return Response.json({ error: "Enter your email and member code" }, { status: 400 });
  }

  try {
    const member = await (deps.authenticateMember ?? authenticateMember)(email, code);
    if (!member) {
      return Response.json(
        { error: "That email and member code do not match a membership" },
        { status: 404 },
      );
    }
    const maxPoints = maxRedeemablePoints(member.pointsBalance, payableCents);
    return Response.json({
      member: memberSummary(member),
      maxPoints,
      maxDiscountCents: pointsValueCents(maxPoints),
      step: REDEEM_STEP_POINTS,
    });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    return Response.json({ error: "Could not read that balance" }, { status: 502 });
  }
}

/** Member codes are secrets, so the admin list never returns them. */
export async function clubAdminMembersGet(
  request: Request,
  deps: ClubApiDeps = {},
): Promise<Response> {
  if (!authorizeAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  try {
    const members = await (deps.listMembers ?? listMembers)(Number.isFinite(limit) ? limit : 50);
    return Response.json({
      members: members.map((member) => ({
        ...memberSummary(member),
        email: member.email,
        createdAt: member.createdAt,
      })),
    });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    return Response.json({ error: "Could not list members" }, { status: 502 });
  }
}

export async function clubAdminAdjustPost(
  request: Request,
  email: string,
  deps: ClubApiDeps = {},
): Promise<Response> {
  if (!authorizeAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await readBody(request);
  const points = Math.trunc(Number(body?.points));
  if (!Number.isFinite(points) || points === 0 || Math.abs(points) > 100_000) {
    return Response.json({ error: "Provide a non-zero points adjustment" }, { status: 400 });
  }
  const note = readString(body?.note) || "Manual adjustment";

  try {
    const member = await (deps.adjustPoints ?? adjustPoints)({ email, points, note });
    if (!member) {
      return Response.json(
        { error: "No member with that email, or the balance is too low" },
        { status: 404 },
      );
    }
    return Response.json({ email: member.email, ...memberSummary(member) });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    return Response.json({ error: "Could not adjust that balance" }, { status: 502 });
  }
}
