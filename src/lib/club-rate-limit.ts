import { normalizeClubEmail } from "./club.ts";
import { clientKey, rateLimit } from "./rate-limit.ts";

/**
 * Attempts to prove membership (balance lookup, checkout quote, redemption at
 * order creation) are limited per email as well as per client, so guessing a
 * code for one address stays infeasible even from many addresses. Counters live
 * in process memory, like the rest of the site's limiters, which means they are
 * per server instance: see docs/redline-club.md.
 */
export const CLUB_CREDENTIAL_EMAIL_LIMIT = { limit: 20, windowMs: 15 * 60_000 };

export const CLUB_CREDENTIAL_CLIENT_LIMIT = { limit: 10, windowMs: 60_000 };

export const CLUB_JOIN_CLIENT_LIMIT = { limit: 5, windowMs: 60_000 };

export const CLUB_JOIN_EMAIL_LIMIT = { limit: 3, windowMs: 15 * 60_000 };

export function allowCredentialAttempt(email: string) {
  const key = normalizeClubEmail(email);
  if (!key) return { ok: true as const, retryAfterMs: 0 };
  return rateLimit(
    `club-credential-email:${key}`,
    CLUB_CREDENTIAL_EMAIL_LIMIT.limit,
    CLUB_CREDENTIAL_EMAIL_LIMIT.windowMs,
  );
}

export function allowClientCredentialAttempt(request: Request, scope: string) {
  return rateLimit(
    `club-${scope}:${clientKey(request)}`,
    CLUB_CREDENTIAL_CLIENT_LIMIT.limit,
    CLUB_CREDENTIAL_CLIENT_LIMIT.windowMs,
  );
}
