import "server-only";

import { randomUUID } from "node:crypto";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { resolveCartLines, type CartLineInput } from "@/lib/order";
import { getOrderStore, type StoredOrder } from "@/lib/orders";
import { lookupPromo, priceOrderCents } from "@/lib/promo";
import { absoluteUrl } from "@/lib/seo";
import { createWhopCheckoutConfiguration, resolveWhop, type WhopMode } from "@/lib/whop";

function allowedOrigin(value: string, env: Record<string, string | undefined>) {
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (host === "localhost" || host === "127.0.0.1") return url.origin;
    if (host === "redlinelabs.shop" || host === "www.redlinelabs.shop") return "https://redlinelabs.shop";
    if (env.VERCEL_URL && url.origin === `https://${env.VERCEL_URL}`) return url.origin;
    if (host.endsWith(".vercel.app") && url.protocol === "https:") return url.origin;
    const site = new URL(absoluteUrl("/"));
    if (url.origin === site.origin) return url.origin;
  } catch {
    return null;
  }
  return null;
}

export function checkoutReturnOrigin(request: Request, env: Record<string, string | undefined> = process.env) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") || "https";
  for (const candidate of [origin, host ? `${proto}://${host}` : null]) {
    if (!candidate) continue;
    const allowed = allowedOrigin(candidate, env);
    if (allowed) return allowed;
  }
  return new URL(absoluteUrl("/")).origin;
}

export async function startWhopCardCheckout(
  input: {
    items: CartLineInput[];
    email: string;
    shipping: ShippingAddressInput | null;
    promoCode?: string | null;
    ageConfirmed: boolean;
    researchUse: boolean;
  },
  origin: string,
) {
  const config = resolveWhop(process.env);
  if (!config) throw new Error("Whop is not configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceOrderCents(subtotalCents, promo);
  if (priced.discountedCents <= 0) throw new Error("Order total must be greater than zero");

  const order: StoredOrder = {
    id: `ord_${randomUUID()}`,
    email: input.email.trim().toLowerCase(),
    status: "pending",
    currency: "aud",
    subtotalCents: priced.catalogCents,
    discountCents: priced.discountCents,
    totalCents: priced.discountedCents,
    lines,
    shipping: input.shipping,
    promoCode: promo?.code ?? "",
    whopCheckoutId: null,
    whopPaymentId: null,
    confirmationSent: false,
    createdAt: new Date().toISOString(),
  };
  const store = getOrderStore();
  await store.save(order);

  const returnUrl = `${origin}/checkout/return?orderId=${encodeURIComponent(order.id)}`;
  try {
    const session = await createWhopCheckoutConfiguration(config, {
      orderId: order.id,
      amountCents: priced.discountedCents,
      returnUrl,
    });
    order.whopCheckoutId = session.sessionId;
    await store.update(order);
    return {
      orderId: order.id,
      sessionId: session.sessionId,
      planId: session.planId,
      environment: (config.mode === "production" ? "production" : "sandbox") as WhopMode,
      amountCents: priced.discountedCents,
      subtotalCents: priced.catalogCents,
      discountCents: priced.discountCents,
      currency: "aud" as const,
      returnUrl,
    };
  } catch (error) {
    order.status = "failed";
    await store.update(order);
    throw error;
  }
}
