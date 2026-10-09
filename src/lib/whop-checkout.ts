import "server-only";

import { absoluteUrl } from "@/lib/seo";
import {
  createCheckoutOrder,
  type CheckoutOrderInput,
} from "@/lib/bank-transfer-checkout";
import type { Sql } from "@/lib/db";
import { findOrder } from "@/lib/orders";
import {
  createWhopCheckoutConfiguration,
  whopConfigured,
  whopEnvironmentName,
  type WhopCheckoutConfiguration,
  type WhopEnvironmentName,
} from "@/lib/whop";

export class WhopOrderSavedError extends Error {
  readonly reference: string;

  constructor(reference: string) {
    super("The order was saved but card checkout did not open");
    this.name = "WhopOrderSavedError";
    this.reference = reference;
  }
}

export type WhopCheckoutSession = {
  reference: string;
  sessionId: string;
  planId: string | null;
  returnUrl: string;
  environment: WhopEnvironmentName;
  totalCents: number;
};

type CreateConfig = (input: {
  orderId: string;
  totalCents: number;
  returnUrl: string;
}) => Promise<WhopCheckoutConfiguration>;

type WhopCheckoutHooks = {
  createConfiguration?: CreateConfig;
  sql?: Sql | null;
};

/**
 * Prices the cart from the catalogue (including the $200 / 10% discount and
 * any promo), stores a pending order, then asks Whop for an embedded session.
 * The browser never supplies the amount.
 */
export async function createWhopCardCheckout(
  input: CheckoutOrderInput,
  hooks: WhopCheckoutHooks = {},
): Promise<WhopCheckoutSession> {
  if (!whopConfigured()) throw new Error("Whop is not configured");
  const order = await createCheckoutOrder(input, {
    paymentMethod: "whop",
    skipBankConfiguration: true,
    skipCreatedEmail: true,
    sql: hooks.sql,
  });
  const returnUrl = absoluteUrl(`/order/${order.reference}`);
  try {
    const configuration = await (hooks.createConfiguration ?? createWhopCheckoutConfiguration)({
      orderId: order.reference,
      totalCents: order.totalCents,
      returnUrl,
    });
    return {
      reference: order.reference,
      sessionId: configuration.id,
      planId: configuration.planId,
      returnUrl,
      environment: whopEnvironmentName(),
      totalCents: order.totalCents,
    };
  } catch (error) {
    if (error instanceof WhopOrderSavedError) throw error;
    throw new WhopOrderSavedError(order.reference);
  }
}

/** A new embedded session for an order that is still unpaid. The amount is the stored total. */
export async function resumeWhopCardCheckout(reference: string): Promise<WhopCheckoutSession> {
  if (!whopConfigured()) throw new Error("Whop is not configured");
  const order = await findOrder(reference);
  if (!order || order.paymentMethod !== "whop") throw new Error("That order cannot be paid by card");
  if (order.status !== "pending" && order.status !== "failed") {
    throw new Error("That order is no longer waiting for a card payment");
  }
  const returnUrl = absoluteUrl(`/order/${order.reference}`);
  const configuration = await createWhopCheckoutConfiguration({
    orderId: order.reference,
    totalCents: order.totalCents,
    returnUrl,
  });
  return {
    reference: order.reference,
    sessionId: configuration.id,
    planId: configuration.planId,
    returnUrl,
    environment: whopEnvironmentName(),
    totalCents: order.totalCents,
  };
}
