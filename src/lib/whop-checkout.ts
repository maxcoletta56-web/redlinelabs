import "server-only";

import { catalogueOrderDraft, type CatalogueShippingInput } from "@/lib/catalogue-order";
import type { CartLineInput } from "@/lib/order";
import {
  findOrder,
  insertOrder,
  ordersConfigured,
  reopenFailedOrder,
  type StoredOrder,
} from "@/lib/orders";
import { whopCheckoutConfigured, type WhopEnvironmentName } from "@/lib/whop-env";
import { createWhopCheckoutSession } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

const DATABASE_TIMEOUT_MS = 12_000;

export class WhopSessionError extends Error {
  readonly reference?: string;

  constructor(message: string, reference?: string) {
    super(message);
    this.name = "WhopSessionError";
    this.reference = reference;
  }
}

export type WhopCardSession = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironmentName;
  returnUrl: string;
};

function returnUrlFor(origin: string, reference: string) {
  return `${origin.replace(/\/$/, "")}/checkout/return/${reference}`;
}

async function sessionForOrder(order: StoredOrder, origin: string, idempotencyKey: string) {
  if (order.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  const session = await createWhopCheckoutSession({
    reference: order.reference,
    totalCents: order.totalCents,
    returnUrl: returnUrlFor(origin, order.reference),
    idempotencyKey,
  });
  return {
    reference: order.reference,
    sessionId: session.sessionId,
    planId: session.planId,
    environment: session.environment,
    returnUrl: returnUrlFor(origin, order.reference),
  };
}

export function assertWhopCheckoutReady() {
  if (!whopCheckoutConfigured()) {
    throw new Error("Whop is not configured");
  }
  if (!ordersConfigured()) {
    throw new Error("Orders are unavailable until the database is configured");
  }
}

/**
 * Prices the cart on the server, stores a pending order, then opens a Whop
 * checkout configuration for that exact total. The browser never supplies
 * the amount.
 */
export async function openWhopCardCheckout(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: CatalogueShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  origin: string;
}): Promise<WhopCardSession> {
  assertWhopCheckoutReady();
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const draft = catalogueOrderDraft(input);
  const reference = await withTimeout(
    insertOrder({ ...draft, status: "pending" }),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );
  try {
    return await sessionForOrder(
      { ...draft, reference, status: "pending", createdAt: null, paidAt: null },
      input.origin,
      `whop-checkout-${reference}`,
    );
  } catch (error) {
    console.error("[whop] checkout configuration failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    throw new WhopSessionError("The card processor did not respond. Nothing has been charged.", reference);
  }
}

/** Opens a new card session for an existing pending or failed order. */
export async function resumeWhopCardCheckout(reference: string, origin: string): Promise<WhopCardSession> {
  assertWhopCheckoutReady();
  const order = await withTimeout(findOrder(reference), DATABASE_TIMEOUT_MS, "The order database");
  if (!order) throw new Error("Order was not found");
  if (order.status === "paid") throw new Error("This order is already paid");
  if (order.status === "awaiting_payment") {
    throw new Error("This order is waiting for a bank transfer");
  }

  const current = order.status === "failed" ? (await reopenFailedOrder(order.reference)) ?? order : order;
  return sessionForOrder(current, origin, `whop-checkout-${current.reference}-${Date.now()}`);
}
