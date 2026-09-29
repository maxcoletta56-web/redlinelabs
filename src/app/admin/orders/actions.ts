"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect, RedirectType } from "next/navigation";
import { adminSecretMatches, adminSessionValid } from "@/lib/admin-auth";
import { clearAdminSession, readAdminSessionToken, setAdminSession } from "@/lib/admin-session";
import { normalizeOrderReference } from "@/lib/order-reference";
import { ordersConfigured } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";
import { recordAdminPayment } from "@/lib/record-admin-payment";

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
 * Same update as POST /api/admin/orders/[reference]/paid, including the
 * payment email. The cookie is checked again here.
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

  const result = await recordAdminPayment(reference);
  if (!result.ok && result.reason === "missing") {
    redirect("/admin/orders?notice=missing", RedirectType.replace);
  }
  if (!result.ok) redirect("/admin/orders?notice=failed", RedirectType.replace);

  revalidatePath("/admin/orders");
  redirect(
    `/admin/orders?notice=paid&reference=${encodeURIComponent(reference)}`,
    RedirectType.replace,
  );
}
