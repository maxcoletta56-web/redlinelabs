import { randomUUID } from "node:crypto";
import {
  createCheckoutOrder,
  type CheckoutOrder,
  type CheckoutOrderInput,
} from "./bank-transfer-checkout.ts";
import { BRAND_NAME } from "./company.ts";
import type { Sql } from "./db.ts";
import type { OrderCreatedNotice } from "./mailer.ts";
import { lineLabel } from "./order.ts";
import { normalizeOrderReference } from "./order-reference.ts";
import {
  attachPaypalOrderId,
  findOrder,
  markOrderPaidWithPaymentEmail,
  type MarkPaidEmailHooks,
  type StoredOrder,
} from "./orders.ts";
import {
  buildPaypalOrder,
  createPaypalOrder,
  isPaypalOrderId,
  resolvePaypal,
  type PaypalEnv,
  type ResolvedPaypal,
} from "./paypal.ts";
import { absoluteUrl } from "./seo.ts";

export class PaypalOrderSavedError extends Error {
  readonly reference: string;

  constructor(reference: string) {
    super("PayPal did not respond. Nothing has been charged.");
    this.name = "PaypalOrderSavedError";
    this.reference = reference;
  }
}

export type PaypalRemoteOrder = {
  id: string;
  approvalUrl: string;
};

export type OpenPaypalCheckoutOptions = {
  sql?: Sql | null;
  deliver?: (notice: OrderCreatedNotice) => Promise<void>;
  env?: PaypalEnv;
  createRemoteOrder?: (
    config: ResolvedPaypal,
    body: ReturnType<typeof buildPaypalOrder>,
    requestId: string,
  ) => Promise<PaypalRemoteOrder>;
  siteUrl?: (path: string) => string;
  findOrder?: (reference: string) => Promise<StoredOrder | null>;
};

export type PaypalCaptureInput = {
  reference: string;
  paypalOrderId: string;
  amountCents: number;
  currency: string;
  captured: boolean;
};

export type PaypalCaptureSettlement =
  | { ok: true; order: StoredOrder; alreadyPaid: boolean }
  | { ok: false; reason: "not_captured" | "amount_mismatch" | "missing" | "paypal_order_mismatch" };

function attemptId() {
  return `rl_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

function paypalShipping(order: {
  shipping: { name: string; line1: string; line2: string; city: string; state: string; postcode: string };
  firstName: string;
  lastName: string;
}) {
  const line2 = order.shipping.line2.trim();
  return {
    name: order.shipping.name.trim() || `${order.firstName} ${order.lastName}`.trim() || "Customer",
    line1: order.shipping.line1,
    ...(line2 ? { line2 } : {}),
    city: order.shipping.city,
    state: order.shipping.state,
    postalCode: order.shipping.postcode,
    countryCode: "AU" as const,
  };
}

async function placeRemoteOrder(
  order: {
    reference: string;
    totalCents: number;
    subtotalCents: number;
    email: string;
    firstName: string;
    lastName: string;
    lines: CheckoutOrder["lines"];
    items: StoredOrder["items"];
    shipping: NonNullable<StoredOrder["shipping"]>;
  },
  config: ResolvedPaypal,
  options: OpenPaypalCheckoutOptions,
  source: "lines" | "items",
) {
  const transactionId = attemptId();
  const url = options.siteUrl ?? absoluteUrl;
  const lines =
    source === "lines"
      ? order.lines.map((line) => ({
          name: lineLabel(line),
          sku: line.sku,
          qty: line.qty,
          unitAmountCents: line.unitAmountCents,
        }))
      : order.items.map((item) => ({
          name: item.name,
          sku: item.sku,
          qty: item.qty,
          unitAmountCents: item.unitAmountCents,
        }));
  const remote = await (options.createRemoteOrder ?? createPaypalOrder)(
    config,
    buildPaypalOrder({
      transactionId,
      amountCents: order.totalCents,
      subtotalCents: order.subtotalCents,
      discountCents: order.subtotalCents - order.totalCents,
      lines,
      shipping: paypalShipping(order),
      email: order.email,
      firstName: order.firstName,
      lastName: order.lastName,
      returnUrl: url(`/checkout/success?session_id=${transactionId}`),
      cancelUrl: url(`/order/${order.reference}?paypal=cancelled`),
      brandName: BRAND_NAME,
    }),
    transactionId,
  );
  if (!isPaypalOrderId(remote.id)) {
    throw new Error("PayPal did not return a card checkout");
  }
  return { ...remote, transactionId };
}

/**
 * Inserts the unpaid order, then opens PayPal. The PayPal id is stored before
 * the buyer is redirected. A PayPal failure after the insert leaves the row
 * awaiting payment so the buyer can retry or pay by PayID.
 */
export async function openPaypalCheckout(
  input: CheckoutOrderInput,
  options: OpenPaypalCheckoutOptions = {},
): Promise<CheckoutOrder & { paypalOrderId: string; approvalUrl: string; transactionId: string }> {
  const config = resolvePaypal(options.env ?? process.env);
  if (!config) throw new Error("PayPal is not configured");
  const rawCountry = (input.shipping?.country ?? "").trim().toUpperCase();
  if (rawCountry && rawCountry !== "AU") {
    throw new Error("A complete Australian shipping address is required");
  }

  const order = await createCheckoutOrder(input, {
    ...(options.sql !== undefined ? { sql: options.sql } : {}),
    ...(options.deliver ? { deliver: options.deliver } : {}),
    paymentMethod: "paypal",
    skipBankConfiguration: true,
  });

  try {
    const remote = await placeRemoteOrder(order, config, options, "lines");
    const attached = await attachPaypalOrderId(order.reference, remote.id, options.sql);
    if (!attached) throw new Error("Could not store the PayPal order");
    return {
      ...order,
      paypalOrderId: remote.id,
      approvalUrl: remote.approvalUrl,
      transactionId: remote.transactionId,
    };
  } catch (error) {
    console.error("[checkout] PayPal order create failed after the order was saved", {
      reference: order.reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    throw new PaypalOrderSavedError(order.reference);
  }
}

/** Opens a new PayPal checkout for an unpaid PayPal order. Paid orders stay put. */
export async function resumePaypalCheckout(
  reference: string,
  options: OpenPaypalCheckoutOptions = {},
): Promise<
  | {
      kind: "approval";
      approvalUrl: string;
      transactionId: string;
      paypalOrderId: string;
      order: StoredOrder;
    }
  | { kind: "order"; reference: string }
> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) throw new Error("That reference is not valid");
  const config = resolvePaypal(options.env ?? process.env);
  if (!config) throw new Error("PayPal is not configured");
  const order = options.findOrder
    ? await options.findOrder(normalized)
    : await findOrder(normalized, options.sql);
  if (!order) throw new Error("That order was not found");
  if (order.status === "paid" || order.paymentMethod !== "paypal") {
    return { kind: "order", reference: order.reference };
  }
  if (!order.shipping) throw new Error("A shipping address is required");

  const remote = await placeRemoteOrder(
    { ...order, lines: [], shipping: order.shipping },
    config,
    options,
    "items",
  );
  const attached = await attachPaypalOrderId(order.reference, remote.id, options.sql);
  if (!attached) throw new Error("Could not store the PayPal order");
  return {
    kind: "approval",
    approvalUrl: remote.approvalUrl,
    transactionId: remote.transactionId,
    paypalOrderId: remote.id,
    order: { ...order, paypalOrderId: remote.id },
  };
}

/**
 * Marks a captured PayPal order paid with the same helper the admin desk uses.
 * A second capture sees `paid` and does not send another receipt. A capture
 * whose currency or amount differs from the stored order is refused.
 */
export async function settleCapturedPaypalOrder(
  input: PaypalCaptureInput,
  hooks: MarkPaidEmailHooks = {},
): Promise<PaypalCaptureSettlement> {
  if (!input.captured) return { ok: false, reason: "not_captured" };
  const lookup = hooks.findOrder ?? findOrder;
  let existing: StoredOrder | null = null;
  try {
    existing = await lookup(input.reference);
  } catch {
    return { ok: false, reason: "missing" };
  }
  if (!existing) return { ok: false, reason: "missing" };

  const currency = input.currency.trim().toLowerCase();
  if (
    currency !== "aud" ||
    existing.currency.trim().toLowerCase() !== "aud" ||
    existing.totalCents !== input.amountCents
  ) {
    return { ok: false, reason: "amount_mismatch" };
  }
  if (!existing.paypalOrderId || existing.paypalOrderId !== input.paypalOrderId) {
    return { ok: false, reason: "paypal_order_mismatch" };
  }

  const alreadyPaid = existing.status === "paid";
  const order = await markOrderPaidWithPaymentEmail(input.reference, hooks);
  if (!order) return { ok: false, reason: "missing" };
  return { ok: true, order, alreadyPaid };
}
