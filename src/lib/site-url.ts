import "server-only";

import { headers } from "next/headers";

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export async function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    return trimTrailingSlash(configured);
  }

  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    throw new Error("NEXT_PUBLIC_SITE_URL is not configured");
  }

  const protocol = headerList.get("x-forwarded-proto") ?? "https";
  return trimTrailingSlash(`${protocol}://${host}`);
}
