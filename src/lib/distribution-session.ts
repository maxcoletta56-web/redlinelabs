import "server-only";

import { cookies } from "next/headers";
import {
  DISTRIBUTION_SESSION_COOKIE,
  createDistributionSessionValue,
  distributionSessionCookieOptions,
  distributionSessionSecret,
} from "@/lib/distribution-auth";

export async function readDistributionSessionToken() {
  const jar = await cookies();
  return jar.get(DISTRIBUTION_SESSION_COOKIE)?.value;
}

export async function setDistributionSession(accountId: string, secure: boolean) {
  const secret = distributionSessionSecret();
  if (!secret) throw new Error("Distribution session secret is not configured");
  const now = Date.now();
  const jar = await cookies();
  jar.set(
    DISTRIBUTION_SESSION_COOKIE,
    createDistributionSessionValue(secret, accountId, now),
    distributionSessionCookieOptions(secure, now),
  );
}

export async function clearDistributionSession(secure: boolean) {
  const jar = await cookies();
  jar.set(DISTRIBUTION_SESSION_COOKIE, "", {
    ...distributionSessionCookieOptions(secure),
    maxAge: 0,
    expires: new Date(0),
  });
}
