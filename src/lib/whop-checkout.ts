import "server-only";

import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import {
  attachWhopCheckout,
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import { lookupPromo, priceOrderCents } from "@/lib/promo";
import { absoluteUrl } from "@/lib/seo";
import { createWhopCheckoutConfiguration, resolveWhop, type WhopEnvironment } from "@/lib/whop";

export type WhopShippingInput = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
};

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function normalizeShipping(shipping: WhopShippingInput | null | undefined): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  if (!line1) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city: trimmed(shipping?.city, 120),
    state: trimmed(shipping?.state, 60),
    postcode: trimmed(shipping?.postal_code, 20),
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

export function whopCardConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(resolveWhop(env)) && ordersConfigured();
}

/**
 * Prices the cart from the catalogue, stores a pending card order, then opens
 * a Whop checkout configuration for that exact AUD total. Browser prices are
 * not an input.
 */
export async function createWhopCardCheckout(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: WhopShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<WhopCardCheckout> {
  const config = resolveWhop(process.env);
  if (!config) throw new Error("Whop is not configured");
  if (!ordersConfigured()) throw new Error("Orders are unavailable until the database is configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceOrderCents(subtotalCents, promo);
  if (priced.totalCents <= 0) throw new Error("Order total must be greater than zero");

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));
  const reference = await insertOrder({
    currency: "aud",
    subtotalCents: priced.subtotalCents,
    totalCents: priced.totalCents,
    promoCode: promo?.code ?? null,
    firstName: trimmed(input.firstName, 120) || "Customer",
    lastName: trimmed(input.lastName, 120) || "Account",
    email: trimmed(input.email, 200).toLowerCase(),
    items,
    shipping: normalizeShipping(input.shipping),
    status: "pending",
    volumeDiscountCents: priced.volumeDiscountCents,
    paymentMethod: "card",
  });

  const returnUrl = absoluteUrl(`/checkout/complete?order=${encodeURIComponent(reference)}`);
  const session = await createWhopCheckoutConfiguration(config, {
    orderId: reference,
    totalCents: priced.totalCents,
    returnUrl,
    companyId: config.companyId,
    productId: config.productId,
  });
  await attachWhopCheckout(reference, session.sessionId).catch((error: unknown) => {
    console.error("[whop] checkout id was not stored", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  });

  return {
    reference,
    sessionId: session.sessionId,
    planId: session.planId,
    environment: config.environment,
    returnUrl,
  };
}
