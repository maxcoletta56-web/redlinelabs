import { createHash, timingSafeEqual } from "node:crypto";

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
