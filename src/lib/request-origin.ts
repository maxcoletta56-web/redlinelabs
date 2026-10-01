import "server-only";

import { headers } from "next/headers";
import { absoluteUrl } from "@/lib/seo";

const HOST = /^[A-Za-z0-9.-]+(?::\d{1,5})?$/;

/** Prefer the request host so 3D Secure returns to this deployment, not a hard-coded origin. */
export async function absoluteRequestUrl(path: string) {
  try {
    const headerList = await headers();
    const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
      .split(",")[0]
      ?.trim();
    if (host && HOST.test(host)) {
      const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
      const proto =
        forwarded === "http" || forwarded === "https"
          ? forwarded
          : host.startsWith("localhost") || host.startsWith("127.0.0.1")
            ? "http"
            : "https";
      return new URL(path, `${proto}://${host}`).toString();
    }
  } catch {
    // headers() throws outside a request; the public site URL still works.
  }
  return absoluteUrl(path);
}
