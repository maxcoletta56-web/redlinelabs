import {
  adjustPoints,
  authenticateMember,
  joinClub,
  listLedger,
  listMembers,
  reconcileClub,
  ClubUnavailableError,
  type ClubLedgerEntry,
  type ClubMember,
} from "./club-db.ts";
import {
  REDEEM_STEP_POINTS,
  activeClubProgram,
  isClubEmail,
  maxRedeemablePoints,
  normalizeClubEmail,
  pointsValueCents,
  tierProgress,
  type ActiveClubProgram,
} from "./club.ts";
import {
  CLUB_JOIN_CLIENT_LIMIT,
  CLUB_JOIN_EMAIL_LIMIT,
  allowClientCredentialAttempt,
  allowCredentialAttempt,
} from "./club-rate-limit.ts";
import { authorizeAdmin } from "./admin-auth.ts";
import { clientKey, rateLimit } from "./rate-limit.ts";

/** Test seams. Production uses the Neon-backed functions above. */
export type ClubApiDeps = {
  joinClub?: typeof joinClub;
  authenticateMember?: typeof authenticateMember;
  listLedger?: typeof listLedger;
  adjustPoints?: typeof adjustPoints;
  listMembers?: typeof listMembers;
  reconcileClub?: typeof reconcileClub;
  program?: ActiveClubProgram | null;
  allowCredentialAttempt?: (email: string) => { ok: boolean; retryAfterMs: number };
};

const UNAVAILABLE = "The club is not available right now. Please try again shortly.";

/** One message for unknown email, wrong code and malformed code: no enumeration. */
export const INVALID_CREDENTIALS = "That email and member code do not match a membership";

function unavailable() {
  return Response.json({ error: UNAVAILABLE }, { status: 503 });
}

function tooMany(retryAfterMs: number) {
  return Response.json(
    { error: "Too many attempts. Please wait a moment and try again." },
    { status: 429, headers: { "retry-after": String(Math.ceil(retryAfterMs / 1000)) } },
  );
}

function invalidCredentials() {
  return Response.json({ error: INVALID_CREDENTIALS }, { status: 401 });
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

function programFor(deps: ClubApiDeps) {
  return deps.program !== undefined ? deps.program : activeClubProgram();
}

/** Tier and point-value fields are `null` while the programme is not approved. */
export function memberSummary(member: ClubMember, program: ActiveClubProgram | null) {
  const progress = program ? tierProgress(program, member.lifetimeSpendCents) : null;
  return {
    firstName: member.firstName,
    tier: progress?.tier.name ?? null,
    tierId: progress?.tier.id ?? null,
    points: member.pointsBalance,
    pointsValueCents: program ? pointsValueCents(program, member.pointsBalance) : null,
    lifetimeSpendCents: member.lifetimeSpendCents,
    nextTier: progress?.next?.name ?? null,
    nextTierRemainingCents: progress?.remainingCents ?? null,
    tierProgressPercent: progress?.percent ?? null,
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
 * Joining returns the member code **only** to the request that just created
 * the membership, and only once: the database keeps its hash. An email that is
 * already a member gets no code and its existing code is never replaced.
 */
export async function clubJoinPost(request: Request, deps: ClubApiDeps = {}): Promise<Response> {
  const client = rateLimit(
    `club-join:${clientKey(request)}`,
    CLUB_JOIN_CLIENT_LIMIT.limit,
    CLUB_JOIN_CLIENT_LIMIT.windowMs,
  );
  if (!client.ok) return tooMany(client.retryAfterMs);

  const body = await readBody(request);
  const email = normalizeClubEmail(readString(body?.email));
  if (!isClubEmail(email)) {
    return Response.json({ error: "Enter a valid email address" }, { status: 400 });
  }
  const perEmail = rateLimit(
    `club-join-email:${email}`,
    CLUB_JOIN_EMAIL_LIMIT.limit,
    CLUB_JOIN_EMAIL_LIMIT.windowMs,
  );
  if (!perEmail.ok) return tooMany(perEmail.retryAfterMs);
  const firstName = readString(body?.firstName).slice(0, 120);

  try {
    const result = await (deps.joinClub ?? joinClub)({ email, firstName });
    if (!result.created) {
      return Response.json({
        created: false,
        memberCode: null,
        message:
          "That email is already in the club. Use the member code you were given when you joined to check your balance.",
      });
    }
    return Response.json({
      created: true,
      memberCode: result.memberCode,
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

type Credentials =
  | { ok: true; member: ClubMember; body: Record<string, unknown> | null }
  | { ok: false; response: Response };

/** Shared by balance and quote: rate limits first, then one generic failure. */
async function verifyCredentials(
  request: Request,
  scope: string,
  deps: ClubApiDeps,
): Promise<Credentials> {
  const client = allowClientCredentialAttempt(request, scope);
  if (!client.ok) return { ok: false, response: tooMany(client.retryAfterMs) };

  const body = await readBody(request);
  const email = normalizeClubEmail(readString(body?.email));
  const code = readString(body?.code);
  if (!isClubEmail(email) || !code) {
    return {
      ok: false,
      response: Response.json({ error: "Enter your email and member code" }, { status: 400 }),
    };
  }
  const perEmail = (deps.allowCredentialAttempt ?? allowCredentialAttempt)(email);
  if (!perEmail.ok) return { ok: false, response: tooMany(perEmail.retryAfterMs) };

  try {
    const member = await (deps.authenticateMember ?? authenticateMember)(email, code);
    if (!member) return { ok: false, response: invalidCredentials() };
    return { ok: true, member, body };
  } catch (error) {
    if (error instanceof ClubUnavailableError) return { ok: false, response: unavailable() };
    console.error("[club] credential check failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      response: Response.json({ error: "Could not read that balance" }, { status: 502 }),
    };
  }
}

export async function clubBalancePost(
  request: Request,
  deps: ClubApiDeps = {},
): Promise<Response> {
  const credentials = await verifyCredentials(request, "balance", deps);
  if (!credentials.ok) return credentials.response;
  try {
    const ledger = await (deps.listLedger ?? listLedger)(credentials.member.email, 20);
    return Response.json({
      member: memberSummary(credentials.member, programFor(deps)),
      ledger: ledgerSummary(ledger),
    });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    console.error("[club] balance lookup failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: "Could not read that balance" }, { status: 502 });
  }
}

/**
 * What the checkout asks before showing the redemption row: who the member is
 * and the most they could spend on an order of this size. The number the
 * customer then submits is re-checked and re-capped server-side when the order
 * is created — this is a display helper, never the authority.
 */
export async function clubQuotePost(request: Request, deps: ClubApiDeps = {}): Promise<Response> {
  const program = programFor(deps);
  if (!program) {
    return Response.json({ enabled: false, maxPoints: 0, maxDiscountCents: 0 });
  }
  const credentials = await verifyCredentials(request, "quote", deps);
  if (!credentials.ok) return credentials.response;

  const payableCents = Math.max(0, Math.trunc(Number(credentials.body?.payableCents)) || 0);
  const maxPoints = maxRedeemablePoints(program, credentials.member.pointsBalance, payableCents);
  return Response.json({
    enabled: true,
    member: memberSummary(credentials.member, program),
    maxPoints,
    maxDiscountCents: pointsValueCents(program, maxPoints),
    step: REDEEM_STEP_POINTS,
  });
}

/** Member codes are only ever stored hashed, so there is nothing secret to leak here. */
export async function clubAdminMembersGet(
  request: Request,
  deps: ClubApiDeps = {},
): Promise<Response> {
  if (!authorizeAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = Number(new URL(request.url).searchParams.get("limit") ?? 50);
  const program = programFor(deps);
  try {
    const members = await (deps.listMembers ?? listMembers)(Number.isFinite(limit) ? limit : 50);
    return Response.json({
      members: members.map((member) => ({
        ...memberSummary(member, program),
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
    return Response.json({ email: member.email, ...memberSummary(member, programFor(deps)) });
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    return Response.json({ error: "Could not adjust that balance" }, { status: 502 });
  }
}

/**
 * The retry path for failed awards and releases. Re-running it is harmless:
 * every step is idempotent in the database.
 */
export async function clubAdminReconcilePost(
  request: Request,
  deps: ClubApiDeps = {},
): Promise<Response> {
  if (!authorizeAdmin(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await readBody(request);
  const limit = Number(body?.limit);
  try {
    const summary = await (deps.reconcileClub ?? reconcileClub)(
      Number.isFinite(limit) && limit > 0 ? { limit } : {},
    );
    return Response.json(summary);
  } catch (error) {
    if (error instanceof ClubUnavailableError) return unavailable();
    console.error("[club] reconcile failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return Response.json({ error: "Could not reconcile the club" }, { status: 502 });
  }
}
