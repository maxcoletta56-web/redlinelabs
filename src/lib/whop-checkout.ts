import "server-only";

import {
  createCheckoutOrder,
  type CheckoutOrder,
  type CheckoutOrderInput,
} from "./bank-transfer-checkout.ts";
import type { Sql } from "./db.ts";
import { absoluteUrl } from "./seo.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import {
  attachWhopCheckoutId,
  findOrder,
  ordersConfigured,
  type StoredOrder,
} from "./orders.ts";
import type { WhopEmbedSession } from "./whop-embed.ts";
import {
  createWhopCheckoutConfiguration,
  resolveWhop,
  type ResolvedWhop,
  type WhopCheckoutConfig,
  type WhopEnvironment,
} from "./whop.ts";

export class WhopOrderSavedError extends Error {
  readonly reference: string;

  constructor(reference: string) {
    super("Card checkout did not start. Nothing has been charged.");
    this.name = "WhopOrderSavedError";
    this.reference = reference;
  }
}

export type { WhopEmbedSession } from "./whop-embed.ts";

export type OpenWhopCheckoutOptions = {
  sql?: Sql | null;
  env?: Record<string, string | undefined>;
  siteUrl?: (path: string) => string;
  createConfiguration?: (
    config: ResolvedWhop,
    input: { orderId: string; amountCents: number; redirectUrl: string },
  ) => Promise<WhopCheckoutConfig>;
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
};

export function whopCheckoutConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(resolveWhop(env)) && ordersConfigured();
}

function returnUrlFor(reference: string, siteUrl: (path: string) => string) {
  return siteUrl(`/checkout/return?order=${encodeURIComponent(reference)}`);
}

function sessionFrom(
  order: {
    reference: string;
    email: string;
    totalCents: number;
    shipping: NonNullable<StoredOrder["shipping"]>;
  },
  checkout: WhopCheckoutConfig,
  environment: WhopEnvironment,
  siteUrl: (path: string) => string,
): WhopEmbedSession {
  return {
    sessionId: checkout.id,
    planId: checkout.planId,
    reference: order.reference,
    environment,
    returnUrl: returnUrlFor(order.reference, siteUrl),
    email: order.email,
    totalCents: order.totalCents,
    address: {
      name: order.shipping.name,
      line1: order.shipping.line1,
      line2: order.shipping.line2,
      city: order.shipping.city,
      state: order.shipping.state,
      postalCode: order.shipping.postcode,
      country: order.shipping.country || "AU",
    },
  };
}

async function openConfiguration(
  order: { reference: string; totalCents: number },
  options: OpenWhopCheckoutOptions,
  config: ResolvedWhop,
  siteUrl: (path: string) => string,
) {
  const create = options.createConfiguration ?? createWhopCheckoutConfiguration;
  return create(config, {
    orderId: order.reference,
    amountCents: order.totalCents,
    redirectUrl: returnUrlFor(order.reference, siteUrl),
  });
}

/**
 * Prices the cart on the server, stores a pending order, then creates a Whop
 * checkout configuration whose inline AUD price is that total.
 */
export async function openWhopCheckout(
  input: CheckoutOrderInput,
  options: OpenWhopCheckoutOptions = {},
): Promise<WhopEmbedSession> {
  const env = options.env ?? process.env;
  const config = resolveWhop(env);
  if (!config) throw new Error("Card checkout is not configured");
  const siteUrl = options.siteUrl ?? absoluteUrl;
  const order: CheckoutOrder = await createCheckoutOrder(input, {
    ...(options.sql !== undefined ? { sql: options.sql } : {}),
    paymentMethod: "whop",
    skipBankConfiguration: true,
    skipOrderEmail: true,
  });
  if (!order.shipping) throw new Error("A shipping address is required");

  try {
    const checkout = await openConfiguration(order, options, config, siteUrl);
    const attached = await attachWhopCheckoutId(order.reference, checkout.id, options.sql);
    if (!attached) throw new Error("Could not store the card checkout");
    return sessionFrom(order, checkout, config.environment, siteUrl);
  } catch (error) {
    if (error instanceof WhopOrderSavedError) throw error;
    console.error("[checkout] Whop configuration failed after the order was saved", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw new WhopOrderSavedError(order.reference);
  }
}

/** A new embedded session for an unpaid card order. The stored total is reused. */
export async function resumeWhopCheckout(
  reference: string,
  options: OpenWhopCheckoutOptions = {},
): Promise<WhopEmbedSession> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) throw new Error("That reference is not valid");
  const env = options.env ?? process.env;
  const config = resolveWhop(env);
  if (!config) throw new Error("Card checkout is not configured");
  const order = options.findOrder
    ? await options.findOrder(normalized)
    : await findOrder(normalized, options.sql);
  if (!order) throw new Error("That order was not found");
  if (order.status === "paid") throw new Error("This order is already paid");
  if (order.paymentMethod !== "whop") throw new Error("This order is not a card payment");
  if (!order.shipping) throw new Error("A shipping address is required");
  const siteUrl = options.siteUrl ?? absoluteUrl;
  const checkout = await openConfiguration(order, options, config, siteUrl);
  const attached = await attachWhopCheckoutId(order.reference, checkout.id, options.sql);
  if (!attached) throw new Error("Could not store the card checkout");
  return sessionFrom(
    { ...order, shipping: order.shipping },
    checkout,
    config.environment,
    siteUrl,
  );
}
