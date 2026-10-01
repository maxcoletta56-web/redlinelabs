const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
  amountCents: number | null;
  currency: string | null;
};

export type ParsedWhopEvent =
  | { kind: "payment"; notice: WhopPaymentNotice }
  | { kind: "requires_action"; paymentId: string; orderId: string; nextAction: string | null }
  | { kind: "ignore" };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Whop money is an exact decimal string plus a currency. Older payloads used a
 * bare number. `amount_after_fees` is what the merchant keeps, so it is not the
 * order total.
 */
export function moneyToCents(value: unknown): { cents: number; currency: string | null } | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return { cents: Math.round(value * 100), currency: null };
  }
  const row = asRecord(value);
  if (!row || typeof row.amount !== "string" || !/^-?\d+(\.\d+)?$/.test(row.amount)) return null;
  const currency = typeof row.currency === "string" ? row.currency.trim().toLowerCase() : null;
  return { cents: Math.round(Number(row.amount) * 100), currency };
}

function chargedAmount(data: Record<string, unknown>) {
  return moneyToCents(data.total) ?? moneyToCents(data.subtotal);
}

function orderIdFrom(data: Record<string, unknown>) {
  const metadata = asRecord(data.metadata);
  const raw = metadata?.orderId ?? metadata?.order_id;
  return typeof raw === "string" ? raw.trim() : "";
}

function paymentIdFrom(data: Record<string, unknown>) {
  return typeof data.id === "string" && PAYMENT_ID.test(data.id) ? data.id : "";
}

/** Reads a verified webhook body. Unknown events are ignored so Whop does not retry them. */
export function parseWhopWebhook(event: unknown): ParsedWhopEvent {
  const row = asRecord(event);
  const data = asRecord(row?.data);
  if (!row || !data) return { kind: "ignore" };
  const paymentId = paymentIdFrom(data);
  const orderId = orderIdFrom(data);
  if (!paymentId || !orderId) return { kind: "ignore" };

  if (row.type === "payment.requires_action") {
    const nextAction = asRecord(data.next_action);
    const nextType = typeof nextAction?.type === "string" ? nextAction.type : null;
    return { kind: "requires_action", paymentId, orderId, nextAction: nextType };
  }

  if (row.type !== "payment.succeeded" && row.type !== "payment.failed") {
    return { kind: "ignore" };
  }

  const charged = chargedAmount(data);
  const currency =
    charged?.currency ??
    (typeof data.currency === "string" ? data.currency.trim().toLowerCase() : null);
  return {
    kind: "payment",
    notice: {
      type: row.type,
      paymentId,
      orderId,
      amountCents: charged?.cents ?? null,
      currency,
    },
  };
}
