import "server-only";

import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql, type Sql } from "@/lib/db";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { attachWhopCheckout, insertOrder, ordersConfigured, type OrderItemSnapshot } from "@/lib/orders";
import { lookupPromo, quoteOrderCents } from "@/lib/promo";
import { absoluteUrl } from "@/lib/seo";
import { withTimeout } from "@/lib/with-timeout";
import { createWhopCheckoutConfiguration, whopConfigured, type WhopEnvironment } from "@/lib/whop";

const DATABASE_TIMEOUT_MS = 12_000;

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  totalCents: number;
};

export function whopCardConfigured() {
  return whopConfigured() && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function databaseFor(sql: Sql | null | undefined, injected: boolean) {
  if (injected) return sql ?? null;
  return getSql();
}

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
  options?: {
    sql?: Sql | null;
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
    returnUrlFor?: (reference: string) => string;
  },
): Promise<WhopCardCheckout> {
  const env = options?.env ?? process.env;
  if (!whopConfigured(env)) {
    throw new Error("Whop is not configured");
  }
  const injected = Boolean(options && "sql" in options);
  const sql = databaseFor(options?.sql, injected);
  if (!sql) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) {
    throw new Error("A shipping address is required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const quote = quoteOrderCents(subtotalCents, promo);
  if (quote.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

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
        subtotalCents: quote.subtotalCents,
        totalCents: quote.totalCents,
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

  const returnUrl = options?.returnUrlFor?.(reference) ?? absoluteUrl(`/checkout/return/${reference}`);
  const session = await createWhopCheckoutConfiguration(
    { orderId: reference, totalCents: quote.totalCents, returnUrl },
    { env, fetchImpl: options?.fetchImpl },
  );

  try {
    await attachWhopCheckout(reference, session.sessionId, sql);
  } catch (error) {
    console.error("[whop] could not store the checkout id", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }

  return {
    reference,
    sessionId: session.sessionId,
    planId: session.planId,
    environment: session.environment,
    returnUrl,
    totalCents: quote.totalCents,
  };
}
