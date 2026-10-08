"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { settleAdminOrderPaid } from "@/lib/admin-mark-paid";
import { adminSecretMatches, adminSessionValid } from "@/lib/admin-auth";
import { clearAdminSession, readAdminSessionToken, setAdminSession } from "@/lib/admin-session";
import { normalizeOrderReference } from "@/lib/order-reference";
import { cancelOrderAndReleasePoints, ordersConfigured } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

function clientIp(headerList: Headers) {
  const forwarded = headerList.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
}

export async function loginAdmin(formData: FormData) {
  const provided = formData.get("secret");
  const secret = process.env.ADMIN_API_SECRET;
  const attempt = typeof provided === "string" ? provided : "";
  if (!secret || !adminSecretMatches(attempt, secret)) {
    const headerList = await headers();
    const limit = rateLimit(`admin-login:${clientIp(headerList)}`, 8, 15 * 60 * 1000);
    redirect(
      limit.ok ? "/admin/orders?error=rejected" : "/admin/orders?error=limited",
      RedirectType.replace,
    );
  }
  await setAdminSession(secret);
  redirect("/admin/orders", RedirectType.replace);
}

export async function logoutAdmin() {
  await clearAdminSession();
  redirect("/admin/orders", RedirectType.replace);
}

/**
 * Same idempotent update as POST /api/admin/orders/[reference]/paid.
 * `settleAdminOrderPaid` calls `markOrderPaidWithPaymentEmail`, the helper the
 * bearer route uses, so both paths look up, mark paid, and schedule the receipt.
 * The cookie is checked again here; the bearer route's auth is left unchanged.
 */
export async function markAdminOrderPaid(formData: FormData) {
  const token = await readAdminSessionToken();
  if (!adminSessionValid(token, process.env.ADMIN_API_SECRET)) {
    redirect("/admin/orders?error=signed-out", RedirectType.replace);
  }
  if (formData.get("confirm") !== "yes") {
    redirect("/admin/orders", RedirectType.replace);
  }

  const rawReference = formData.get("reference");
  const reference = normalizeOrderReference(typeof rawReference === "string" ? rawReference : "");
  if (!reference) {
    redirect("/admin/orders?notice=invalid", RedirectType.replace);
  }
  if (!ordersConfigured()) {
    redirect("/admin/orders?notice=unavailable", RedirectType.replace);
  }

  const settled = await settleAdminOrderPaid(reference);
  if (settled.notice === "failed") redirect(settled.location, RedirectType.replace);
  if (settled.notice === "missing") redirect(settled.location, RedirectType.replace);

  revalidatePath("/admin/orders");
  redirect(settled.location, RedirectType.replace);
}

/**
 * Cancels an unpaid order and returns any Club points reserved for it. Doing
 * it again retries the release, so a failed release can be recovered here.
 */
export async function cancelAdminOrder(formData: FormData) {
  const token = await readAdminSessionToken();
  if (!adminSessionValid(token, process.env.ADMIN_API_SECRET)) {
    redirect("/admin/orders?error=signed-out", RedirectType.replace);
  }
  if (formData.get("confirm") !== "yes") {
    redirect("/admin/orders", RedirectType.replace);
  }

  const rawReference = formData.get("reference");
  const reference = normalizeOrderReference(typeof rawReference === "string" ? rawReference : "");
  if (!reference) {
    redirect("/admin/orders?notice=invalid", RedirectType.replace);
  }
  if (!ordersConfigured()) {
    redirect("/admin/orders?notice=unavailable", RedirectType.replace);
  }

  let location = "/admin/orders?notice=failed";
  try {
    const result = await cancelOrderAndReleasePoints(reference);
    if (result.outcome === "missing") location = "/admin/orders?notice=missing";
    else if (result.outcome === "paid") location = "/admin/orders?notice=not-cancellable";
    else if (result.releaseFailed) location = "/admin/orders?notice=release-failed";
    else location = `/admin/orders?notice=cancelled&reference=${encodeURIComponent(reference)}`;
  } catch (error) {
    console.error("[admin] cancel order failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }

  revalidatePath("/admin/orders");
  redirect(location, RedirectType.replace);
}
