import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { adminSecretMatches } from "./admin-auth.ts";

export const DISTRIBUTION_SESSION_COOKIE = "rl_distribution_session";

export const DISTRIBUTION_SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const DISTRIBUTION_SESSION_MAX_AGE_SECONDS = 14 * 24 * 60 * 60;

const MIN_SECRET_LENGTH = 16;
const KEY_LENGTH = 32;
const ACCOUNT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function distributionSessionSecret(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const dedicated = env.DISTRIBUTION_SESSION_SECRET?.trim() ?? "";
  if (dedicated.length >= MIN_SECRET_LENGTH) return dedicated;
  const admin = env.ADMIN_API_SECRET?.trim() ?? "";
  if (admin.length >= MIN_SECRET_LENGTH) return admin;
  return null;
}

export function distributionCookieSecure(
  forwardedProto: string | null | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
) {
  const proto = forwardedProto?.split(",")[0]?.trim();
  if (proto === "https") return true;
  if (proto === "http") return false;
  return nodeEnv === "production";
}

export type DistributionSessionCookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
  expires: Date;
};

export function distributionSessionCookieOptions(
  secure: boolean,
  now = Date.now(),
): DistributionSessionCookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: DISTRIBUTION_SESSION_MAX_AGE_SECONDS,
    expires: new Date(now + DISTRIBUTION_SESSION_TTL_MS),
  };
}

function deriveKey(password: string, salt: string) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

export async function hashDistributionPassword(
  password: string,
  salt = randomBytes(16).toString("hex"),
) {
  const key = await deriveKey(password, salt);
  return { salt, hash: key.toString("hex") };
}

export async function verifyDistributionPassword(
  password: string,
  salt: string,
  expectedHash: string,
) {
  const key = await deriveKey(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  if (expected.length !== key.length || expectedHash.length !== key.length * 2) {
    return false;
  }
  return timingSafeEqual(key, expected);
}

export function createDistributionSessionValue(
  secret: string,
  accountId: string,
  now = Date.now(),
) {
  const trimmed = secret.trim();
  if (trimmed.length < MIN_SECRET_LENGTH) {
    throw new Error("Distribution session secret is not configured");
  }
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error("Distribution account id is not valid");
  }
  const expiresAt = now + DISTRIBUTION_SESSION_TTL_MS;
  const payload = `${accountId}.${expiresAt}`;
  const signature = createHmac("sha256", trimmed).update(payload).digest("hex");
  return `${payload}.${signature}`;
}

/** Account id when the cookie is signed by the configured secret and still current. */
export function readDistributionSessionAccount(
  token: string | null | undefined,
  secret: string | null | undefined,
  now = Date.now(),
) {
  const trimmed = secret?.trim() ?? "";
  if (trimmed.length < MIN_SECRET_LENGTH || !token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [accountId, expiresRaw, signature] = parts;
  if (!accountId || !ACCOUNT_ID_PATTERN.test(accountId)) return null;
  if (!expiresRaw || !/^\d+$/.test(expiresRaw) || !signature || !/^[a-f0-9]{64}$/.test(signature)) {
    return null;
  }
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= now) return null;
  const expected = createHmac("sha256", trimmed).update(`${accountId}.${expiresAt}`).digest("hex");
  if (!adminSecretMatches(signature, expected)) return null;
  return accountId;
}
