import "server-only";

import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminSessionCookieOptions,
  createAdminSessionValue,
} from "@/lib/admin-auth";

export async function readAdminSessionToken() {
  const jar = await cookies();
  return jar.get(ADMIN_SESSION_COOKIE)?.value;
}

export async function setAdminSession(secret: string) {
  const now = Date.now();
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, createAdminSessionValue(secret, now), adminSessionCookieOptions(now));
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, "0", {
    ...adminSessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
}
