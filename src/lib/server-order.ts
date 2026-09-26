import { randomUUID } from "node:crypto";
import type { OrderQuote } from "./cart-quote.ts";
import type { ShippingAddressInput } from "./shipping.ts";

export type PaymentMethod = "card" | "bank_transfer";
export type ServerOrderStatus = "pending" | "paid" | "failed";

export type ServerOrder = {
  id: string;
  status: ServerOrderStatus;
  email: string;
  firstName: string;
  lastName: string;
  currency: "aud";
  lines: OrderQuote["lines"];
  subtotalCents: number;
  volumeDiscountCents: number;
  promoCode: string;
  promoPercentOff: number;
  promoDiscountCents: number;
  totalCents: number;
  shipping: ShippingAddressInput | null;
  paymentMethod: PaymentMethod;
  whopCheckoutId: string | null;
  whopPlanId: string | null;
  whopPaymentId: string | null;
  appliedPayments: Record<string, "paid" | "failed">;
  confirmationSentForPaymentId: string | null;
  createdAt: string;
  updatedAt: string;
};

export function newOrderId() {
  return `rl_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

export function createPendingOrder(input: {
  id?: string;
  quote: OrderQuote;
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: ShippingAddressInput | null;
  paymentMethod: PaymentMethod;
  now?: Date;
}): ServerOrder {
  const now = (input.now ?? new Date()).toISOString();
  return {
    id: input.id ?? newOrderId(),
    status: "pending",
    email: input.email.trim(),
    firstName: input.firstName?.trim() || "Customer",
    lastName: input.lastName?.trim() || "Account",
    currency: "aud",
    lines: input.quote.lines,
    subtotalCents: input.quote.subtotalCents,
    volumeDiscountCents: input.quote.volumeDiscountCents,
    promoCode: input.quote.promoCode,
    promoPercentOff: input.quote.promoPercentOff,
    promoDiscountCents: input.quote.promoDiscountCents,
    totalCents: input.quote.totalCents,
    shipping: input.shipping ?? null,
    paymentMethod: input.paymentMethod,
    whopCheckoutId: null,
    whopPlanId: null,
    whopPaymentId: null,
    appliedPayments: {},
    confirmationSentForPaymentId: null,
    createdAt: now,
    updatedAt: now,
  };
}

export type PaymentUpdate =
  | { kind: "duplicate"; order: ServerOrder }
  | { kind: "failed"; order: ServerOrder }
  | { kind: "paid"; order: ServerOrder };

/**
 * Applies a Whop payment id once. A repeated id is a no-op. A failure does
 * not downgrade an order that is already paid. A later successful payment
 * can still mark a failed order paid. The paid result is saved before the
 * confirmation email; the payment id is recorded only after that email is sent.
 */
export function beginPaymentUpdate(
  order: ServerOrder,
  paymentId: string,
  outcome: "paid" | "failed",
  now = new Date(),
): PaymentUpdate {
  const previous = order.appliedPayments[paymentId];
  if (previous === "paid" || (previous === "failed" && outcome === "failed")) {
    return { kind: "duplicate", order };
  }

  const updatedAt = now.toISOString();
  if (outcome === "failed") {
    if (order.status === "paid") return { kind: "duplicate", order };
    return {
      kind: "failed",
      order: {
        ...order,
        status: "failed",
        appliedPayments: { ...order.appliedPayments, [paymentId]: "failed" },
        updatedAt,
      },
    };
  }

  return {
    kind: "paid",
    order: {
      ...order,
      status: "paid",
      whopPaymentId: paymentId,
      updatedAt,
    },
  };
}

export function completePaidEmail(order: ServerOrder, paymentId: string, now = new Date()): ServerOrder {
  return {
    ...order,
    status: "paid",
    whopPaymentId: paymentId,
    appliedPayments: { ...order.appliedPayments, [paymentId]: "paid" },
    confirmationSentForPaymentId: paymentId,
    updatedAt: now.toISOString(),
  };
}
