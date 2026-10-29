import {
  findOrder,
  markOrderPaidWithPaymentEmail,
  markWhopOrderFailed,
  markWhopOrderPaid,
  type StoredOrder,
} from "@/lib/orders";
import type { Sql } from "@/lib/db";
import { verifyWhopSignature, WhopSignatureError, resolveWhop } from "@/lib/whop";

const MAX_BODY_BYTES = 100_000;

export type WhopWebhookResult = {
  status: number;
  body: { received: true } | { error: string };
};

type PaymentEvent = {
  type: string;
  paymentId: string;
  orderId: string;
  amountCents: number;
  currency: string;
  planId: string | null;
  checkoutId: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** AUD money with two decimal places, in cents. `"306.00"` is 30600. */
export function audMoneyToCents(value: unknown): { cents: number; currency: string } | null {
  const row = asRecord(value);
  if (!row) return null;
  const currency = readString(row.currency).toLowerCase();
  const amount = readString(row.amount);
  const decimals = row.decimals;
  if (currency !== "aud" || decimals !== 2 || !/^\d+\.\d{2}$/.test(amount)) return null;
  const [whole, frac] = amount.split(".");
  const cents = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(cents)) return null;
  return { cents, currency };
}

function readPaymentEvent(value: unknown): PaymentEvent | null {
  const event = asRecord(value);
  const data = asRecord(event?.data);
  if (!event || !data) return null;
  const type = readString(event.type);
  const paymentId = readString(data.id);
  const metadata = asRecord(data.metadata);
  const orderId = readString(metadata?.orderId);
  const money = audMoneyToCents(data.total) ?? audMoneyToCents(data.presentment_total);
  if (!type || !/^[A-Za-z0-9_:-]{3,80}$/.test(paymentId) || !orderId || !money) return null;
  const planId = readString(data.variant_id) || null;
  const checkoutId = readString(data.checkout_configuration_id) || null;
  return {
    type,
    paymentId,
    orderId,
    amountCents: money.cents,
    currency: money.currency,
    planId,
    checkoutId,
  };
}

function idsMatch(order: StoredOrder, event: PaymentEvent) {
  if (order.whopPlanId && event.planId && order.whopPlanId !== event.planId) return false;
  if (
    order.whopCheckoutId &&
    event.checkoutId &&
    order.whopCheckoutId !== event.checkoutId &&
    (!event.planId || event.planId !== order.whopPlanId)
  ) {
    return false;
  }
  return true;
}

export async function handleWhopWebhook(
  rawBody: string,
  headers: Headers,
  options: {
    env?: NodeJS.ProcessEnv;
    sql?: Sql | null;
    nowMs?: number;
    /** Test hook. Production sends the payment confirmation email. */
    notifyPaid?: (order: StoredOrder) => Promise<void>;
  } = {},
): Promise<WhopWebhookResult> {
  if (Buffer.byteLength(rawBody) > MAX_BODY_BYTES) {
    return { status: 400, body: { error: "Payload too large" } };
  }
  const env = options.env ?? process.env;
  const secret = resolveWhop(env)?.webhookSecret || env.WHOP_WEBHOOK_SECRET?.trim() || "";
  let parsed: unknown;
  try {
    parsed = verifyWhopSignature(rawBody, headers, secret, options.nowMs);
  } catch (error) {
    if (error instanceof WhopSignatureError) {
      return { status: 401, body: { error: "Invalid signature" } };
    }
    return { status: 400, body: { error: "Invalid payload" } };
  }

  const event = readPaymentEvent(parsed);
  const type = readString(asRecord(parsed)?.type);
  if (type === "payment.requires_action") {
    return { status: 200, body: { received: true } };
  }
  if (type !== "payment.succeeded" && type !== "payment.failed") {
    return { status: 200, body: { received: true } };
  }
  if (!event) return { status: 200, body: { received: true } };

  const sql = options.sql === undefined ? undefined : options.sql;
  const order = await findOrder(event.orderId, sql);
  if (!order || order.paymentMethod !== "whop" || !idsMatch(order, event)) {
    return { status: 200, body: { received: true } };
  }
  if (order.totalCents !== event.amountCents || order.currency.toLowerCase() !== event.currency) {
    console.error("[whop] payment amount did not match the order", {
      reference: order.reference,
      paymentId: event.paymentId,
    });
    return { status: 200, body: { received: true } };
  }

  const update = {
    reference: order.reference,
    paymentId: event.paymentId,
    amountCents: event.amountCents,
    currency: event.currency,
  };

  if (type === "payment.failed") {
    if (order.status === "paid") return { status: 200, body: { received: true } };
    if (order.status === "failed" && order.whopPaymentId === event.paymentId) {
      return { status: 200, body: { received: true } };
    }
    await markWhopOrderFailed(update, sql);
    return { status: 200, body: { received: true } };
  }

  if (order.status === "paid" && (!order.whopPaymentId || order.whopPaymentId === event.paymentId)) {
    return { status: 200, body: { received: true } };
  }
  if (order.status === "paid") return { status: 200, body: { received: true } };

  const paid = await markWhopOrderPaid(update, sql);
  if (!paid) return { status: 200, body: { received: true } };
  if (options.notifyPaid) {
    await options.notifyPaid(paid);
  } else {
    await markOrderPaidWithPaymentEmail(paid.reference, {
      findOrder: async () => order,
      markOrderPaid: async () => paid,
    });
  }
  return { status: 200, body: { received: true } };
}
