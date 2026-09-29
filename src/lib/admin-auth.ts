import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function bearerToken(header: string | null | undefined): string {
  const match = /^Bearer\s+(\S+)$/i.exec((header ?? "").trim());
  return match?.[1] ?? "";
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Compares fixed-length digests so the check is constant time and a wrong
 * secret never leaks its length through timingSafeEqual's length check.
 */
export function adminSecretMatches(provided: string, expected: string | undefined): boolean {
  const secret = expected?.trim() ?? "";
  if (!secret || !provided) return false;
  return timingSafeEqual(digest(provided), digest(secret));
}

/** False when ADMIN_API_SECRET is unset, which closes the admin endpoints. */
export function authorizeAdmin(
  request: Request,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return adminSecretMatches(
    bearerToken(request.headers.get("authorization")),
    env.ADMIN_API_SECRET,
  );
}

/** Browser session for /admin. The value is an expiry plus an HMAC, never the secret. */
export const ADMIN_SESSION_COOKIE = "rl_admin_session";

export const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export const ADMIN_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60;

export type AdminSessionCookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: "strict";
  path: "/admin";
  maxAge: number;
  expires: Date;
};

export function adminSessionCookieOptions(now = Date.now()): AdminSessionCookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/admin",
    maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
    expires: new Date(now + ADMIN_SESSION_TTL_MS),
  };
}

function sessionSignature(secret: string, expiresAt: number) {
  return createHmac("sha256", secret).update(String(expiresAt)).digest("hex");
}

/** Signed session token. Call only after `adminSecretMatches` has accepted the secret. */
export function createAdminSessionValue(secret: string, now = Date.now()): string {
  const trimmed = secret.trim();
  if (!trimmed) throw new Error("Admin secret is not configured");
  const expiresAt = now + ADMIN_SESSION_TTL_MS;
  return `${expiresAt}.${sessionSignature(trimmed, expiresAt)}`;
}

/**
 * True when the cookie was signed by the configured secret and has not expired.
 * The signature check goes through `adminSecretMatches`, so it stays constant time.
 */
export function adminSessionValid(
  token: string | null | undefined,
  secret: string | undefined,
  now = Date.now(),
): boolean {
  const trimmed = secret?.trim() ?? "";
  if (!trimmed || !token) return false;
  const dot = token.indexOf(".");
  if (dot <= 0 || dot !== token.lastIndexOf(".")) return false;
  const expiresAt = Number(token.slice(0, dot));
  const signature = token.slice(dot + 1);
  if (!Number.isSafeInteger(expiresAt) || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const matches = adminSecretMatches(signature, sessionSignature(trimmed, expiresAt));
  return matches && expiresAt > now;
}
