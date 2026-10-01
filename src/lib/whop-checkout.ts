import "server-only";

import { headers } from "next/headers";
import { normalizeOrderShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { insertOrder, ordersConfigured, type OrderItemSnapshot } from "@/lib/orders";
import { lookupPromo } from "@/lib/promo";
import { quoteCheckoutCents } from "@/lib/promo-pricing";
import { withTimeout } from "@/lib/with-timeout";
import {
  buildWhopCheckoutBody,
  readWhopCheckoutIds,
  whopApiBase,
  whopCredentialsPresent,
  whopEnvironment,
  whopReturnUrl,
  type WhopEmbedSession,
} from "@/lib/whop-plan";

const DATABASE_TIMEOUT_MS = 12_000;
const WHOP_TIMEOUT_MS = 15_000;

export function whopCardConfigured() {
  return whopCredentialsPresent(process.env) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

async function requestOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) {
    const fallback = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
    if (!fallback) throw new Error("Checkout could not determine the site URL");
    return fallback;
  }
  const forwarded = headerList.get("x-forwarded-proto");
  const proto =
    forwarded ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

async function createWhopConfiguration(
  body: ReturnType<typeof buildWhopCheckoutBody>,
  fetchImpl: typeof fetch,
) {
  const apiKey = process.env.WHOP_API_KEY?.trim() ?? "";
  const environment = whopEnvironment(process.env.WHOP_ENVIRONMENT);
  const response = await fetchImpl(`${whopApiBase(environment)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(WHOP_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.error("[whop] checkout configuration failed", { status: response.status });
    throw new Error("The card processor did not accept the order");
  }
  const ids = readWhopCheckoutIds(await response.json());
  if (!ids) throw new Error("The card processor returned an incomplete checkout");
  return { ...ids, environment };
}

/**
 * Prices come from the catalogue. The browser may send slugs and quantities only.
 * The order is stored as pending before Whop is asked for a checkout configuration,
 * and `metadata.orderId` is the order reference the webhook matches.
 */
export async function createWhopCardCheckout(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: BankTransferShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<WhopEmbedSession> {
  if (!whopCredentialsPresent(process.env)) {
    throw new Error("Card checkout is not configured");
  }
  if (!ordersConfigured()) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const quote = quoteCheckoutCents(subtotalCents, promo);
  if (quote.totalCents <= 0) throw new Error("Order total must be greater than zero");

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));

  const reference = await withTimeout(
    insertOrder({
      status: "pending",
      currency: "aud",
      subtotalCents: quote.subtotalCents,
      totalCents: quote.totalCents,
      promoCode: promo?.code ?? null,
      firstName: trimmed(input.firstName, 120) || "Customer",
      lastName: trimmed(input.lastName, 120) || "Account",
      email: trimmed(input.email, 200).toLowerCase(),
      items,
      shipping: normalizeOrderShipping(input.shipping),
    }),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const returnUrl = whopReturnUrl(await requestOrigin(), reference);
  const companyId = process.env.WHOP_COMPANY_ID?.trim() ?? "";
  const configuration = await withTimeout(
    createWhopConfiguration(
      buildWhopCheckoutBody({
        companyId,
        orderId: reference,
        totalCents: quote.totalCents,
        returnUrl,
      }),
      fetch,
    ),
    WHOP_TIMEOUT_MS,
    "The card processor",
  );

  return {
    sessionId: configuration.sessionId,
    planId: configuration.planId,
    environment: configuration.environment,
    reference,
    totalCents: quote.totalCents,
    returnUrl,
  };
}
