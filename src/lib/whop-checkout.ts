import "server-only";

import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql, type Sql } from "@/lib/db";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { insertOrder, ordersConfigured, type OrderItemSnapshot } from "@/lib/orders";
import { lookupPromo, priceCatalogue } from "@/lib/promo";
import { absoluteRequestUrl } from "@/lib/request-origin";
import { withTimeout } from "@/lib/with-timeout";
import {
  createWhopCheckoutConfiguration,
  whopCheckoutBody,
  whopConfigured,
  whopEmbedEnvironment,
  type WhopEmbedEnvironment,
  type WhopEnv,
} from "@/lib/whop";

const DATABASE_TIMEOUT_MS = 12_000;

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEmbedEnvironment;
  returnUrl: string;
  totalCents: number;
};

export function whopCardConfigured(env: WhopEnv = process.env) {
  return whopConfigured(env) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * Prices the cart from the catalogue, stores a pending order, then opens a
 * Whop checkout configuration for that exact AUD amount. Browser prices are
 * never read.
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
  options?: { sql?: Sql | null; env?: WhopEnv; fetchImpl?: typeof fetch },
): Promise<WhopCardCheckout> {
  const env = options?.env ?? process.env;
  if (!whopConfigured(env)) throw new Error("Card checkout is not configured");
  const sql = options && "sql" in options ? (options.sql ?? null) : getSql();
  if (!sql) throw new Error("Orders are unavailable until the database is configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) throw new Error("A shipping address is required");

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceCatalogue(subtotalCents, promo);
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
  const firstName = trimmed(input.firstName, 120) || "Customer";
  const lastName = trimmed(input.lastName, 120) || "Account";
  const email = trimmed(input.email, 200).toLowerCase();

  const reference = await withTimeout(
    insertOrder(
      {
        status: "pending",
        currency: "aud",
        subtotalCents,
        totalCents: priced.totalCents,
        promoCode: promo?.code ?? null,
        firstName,
        lastName,
        email,
        items,
        shipping,
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const redirectUrl = await absoluteRequestUrl(`/checkout/complete?order=${reference}`);
  const body = whopCheckoutBody({
    totalCents: priced.totalCents,
    orderId: reference,
    redirectUrl,
    title: `Redline Labs ${reference}`,
    accountId: env.WHOP_COMPANY_ID,
    productId: env.WHOP_PRODUCT_ID,
  });
  const session = await createWhopCheckoutConfiguration(
    body,
    reference,
    env,
    options?.fetchImpl,
  );
  const returnUrl = await absoluteRequestUrl(
    `/checkout/complete?order=${encodeURIComponent(reference)}&session=${encodeURIComponent(session.sessionId)}&plan=${encodeURIComponent(session.planId)}`,
  );

  return {
    reference,
    sessionId: session.sessionId,
    planId: session.planId,
    environment: whopEmbedEnvironment(env),
    returnUrl,
    totalCents: priced.totalCents,
  };
}
