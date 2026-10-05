import "server-only";

import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql, type Sql } from "@/lib/db";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { insertOrder, ordersConfigured, type OrderItemSnapshot } from "@/lib/orders";
import { lookupPromo } from "@/lib/promo";
import { orderAmountDueCents } from "@/lib/promo-pricing";
import { absoluteUrl } from "@/lib/seo";
import { withTimeout } from "@/lib/with-timeout";
import {
  readCreatedWhopCheckout,
  resolveWhop,
  whopCheckoutRequest,
  whopEmbedEnvironment,
  WHOP_API_VERSION,
  type WhopEmbedEnvironment,
} from "@/lib/whop";

const DATABASE_TIMEOUT_MS = 12_000;
const WHOP_TIMEOUT_MS = 12_000;

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEmbedEnvironment;
  returnUrl: string;
  totalCents: number;
};

export type CreateWhopCardCheckoutOptions = {
  sql?: Sql | null;
  fetchImpl?: typeof fetch;
};

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function databaseFor(options?: CreateWhopCardCheckoutOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/whsec_[A-Za-z0-9+/=_-]+/gi, "whsec_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

export function whopCardCheckoutConfigured() {
  return whopCardConfiguredFromEnv() && ordersConfigured();
}

function whopCardConfiguredFromEnv() {
  return resolveWhop(process.env) !== null;
}

/**
 * Prices the cart from the catalogue, stores a pending order, then opens a
 * Whop checkout configuration for that exact AUD amount.
 */
export async function createWhopCardCheckout(
  input: {
    items: CartLineInput[];
    email: string;
    firstName?: string;
    lastName?: string;
    shipping?: BankTransferShippingInput | null;
    promoCode?: string | null;
    ageConfirmed: boolean;
    researchUse: boolean;
  },
  options?: CreateWhopCardCheckoutOptions,
): Promise<WhopCardCheckout> {
  const config = resolveWhop(process.env);
  if (!config) throw new Error("Card checkout is not configured");
  const sql = databaseFor(options);
  if (!sql) throw new Error("Orders are unavailable until the database is configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) throw new Error("A shipping address is required");

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = orderAmountDueCents(subtotalCents, promo);
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
  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents,
        totalCents: priced.totalCents,
        promoCode: promo?.code ?? null,
        firstName: trimmed(input.firstName, 120) || "Customer",
        lastName: trimmed(input.lastName, 120) || "Account",
        email: trimmed(input.email, 200).toLowerCase(),
        items,
        shipping,
        status: "pending",
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const returnUrl = absoluteUrl(`/checkout/return/${reference}`);
  const body = whopCheckoutRequest({
    companyId: config.companyId,
    totalCents: priced.totalCents,
    orderId: reference,
    redirectUrl: returnUrl,
  });
  const fetchImpl = options?.fetchImpl ?? fetch;
  let payload: unknown;
  try {
    const response = await withTimeout(
      fetchImpl(`${config.apiBase}/checkout_configurations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
          "Api-Version-Date": WHOP_API_VERSION,
          "Idempotency-Key": `order-${reference}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(WHOP_TIMEOUT_MS),
      }),
      WHOP_TIMEOUT_MS,
      "The card processor",
    );
    const text = await response.text();
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      throw new Error(`Whop checkout configuration failed with HTTP ${response.status}`);
    }
  } catch (error) {
    console.error("[whop] checkout configuration failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: redactError(error),
    });
    throw new Error("The card processor did not accept the order. Nothing has been charged.");
  }

  const created = readCreatedWhopCheckout(payload);
  return {
    reference,
    sessionId: created.sessionId,
    planId: created.planId,
    environment: whopEmbedEnvironment(config.environment),
    returnUrl,
    totalCents: priced.totalCents,
  };
}
