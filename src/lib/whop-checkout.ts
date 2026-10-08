import "server-only";

import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql, type Sql } from "@/lib/db";
import type { CartLineInput } from "@/lib/order";
import { findOrder, insertOrder, markPendingOrderFailed, ordersConfigured } from "@/lib/orders";
import { cardLineSnapshots, priceCardOrder } from "@/lib/whop-pricing";
import { createWhopCheckoutConfiguration, whopConfigured, whopReturnUrl } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

const DATABASE_TIMEOUT_MS = 12_000;

export function whopCheckoutConfigured() {
  return whopConfigured() && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

export type WhopCheckoutSession = {
  reference: string;
  sessionId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  amountCents: number;
};

type ConfigurationCreator = typeof createWhopCheckoutConfiguration;

type CreateOptions = {
  sql?: Sql | null;
  deliverConfiguration?: ConfigurationCreator;
};

function databaseFor(options?: CreateOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

/**
 * Saves a pending order at the catalogue price, then asks Whop for an embedded
 * checkout configuration. The browser never supplies the amount.
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
    returnOrigin: string;
  },
  options?: CreateOptions,
): Promise<WhopCheckoutSession> {
  if (!whopConfigured()) throw new Error("Card checkout is not configured");
  const sql = databaseFor(options);
  if (!sql) throw new Error("Orders are unavailable until the database is configured");
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) throw new Error("A shipping address is required");

  const priced = priceCardOrder(input.items, input.promoCode);
  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents: priced.subtotalCents,
        totalCents: priced.totalCents,
        promoCode: priced.promoCode,
        firstName: trimmed(input.firstName, 120) || "Customer",
        lastName: trimmed(input.lastName, 120) || "Account",
        email: trimmed(input.email, 200).toLowerCase(),
        items: cardLineSnapshots(priced.lines),
        shipping,
        status: "pending",
        volumeDiscountCents: priced.volumeDiscountCents,
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  try {
    return await openWhopSession(reference, priced.totalCents, input.returnOrigin, options);
  } catch (error) {
    await markPendingOrderFailed(reference, sql).catch((markError: unknown) => {
      console.error("[whop] could not mark the pending order failed", {
        reference,
        errorName: markError instanceof Error ? markError.name : "unknown",
      });
    });
    throw error;
  }
}

/**
 * A failed or abandoned card attempt reuses the stored total. Metadata still
 * carries the original order id. The idempotency key changes so Whop will
 * issue a fresh configuration the buyer can pay.
 */
export async function resumeWhopCardCheckout(
  reference: string,
  returnOrigin: string,
  options?: CreateOptions,
): Promise<WhopCheckoutSession> {
  if (!whopConfigured()) throw new Error("Card checkout is not configured");
  const sql = databaseFor(options);
  if (!sql) throw new Error("Orders are unavailable until the database is configured");
  const order = await findOrder(reference, sql);
  if (!order) throw new Error("That order could not be found");
  if (order.status === "paid") throw new Error("This order is already paid");
  if (order.status !== "pending" && order.status !== "failed") {
    throw new Error("This order is not waiting for a card payment");
  }
  return openWhopSession(order.reference, order.totalCents, returnOrigin, options, `resume-${Date.now()}`);
}

async function openWhopSession(
  reference: string,
  totalCents: number,
  returnOrigin: string,
  options: CreateOptions | undefined,
  idempotencySuffix?: string,
): Promise<WhopCheckoutSession> {
  const create = options?.deliverConfiguration ?? createWhopCheckoutConfiguration;
  const configuration = await create({
    orderId: reference,
    totalCents,
    idempotencyKey: idempotencySuffix
      ? `whop-checkout-${reference}-${idempotencySuffix}`
      : `whop-checkout-${reference}`,
  });
  return {
    reference,
    sessionId: configuration.id,
    environment: configuration.environment,
    returnUrl: whopReturnUrl(returnOrigin, reference),
    amountCents: totalCents,
  };
}
