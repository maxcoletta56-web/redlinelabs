function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

/** Convert a Whop money value into cents. AUD charges use 2 decimal places. */
export function moneyToCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value === "string" && value.trim()) {
    const amount = Number(value);
    return Number.isFinite(amount) ? Math.round(amount * 100) : null;
  }
  const row = asRecord(value);
  if (!row) return null;
  const amount = readString(row.amount);
  if (!amount) return null;
  const negative = amount.startsWith("-");
  const [wholeRaw, fractionRaw = ""] = amount.replace("-", "").split(".");
  const decimals = Number.isInteger(row.decimals) ? Number(row.decimals) : 2;
  const fraction = fractionRaw.padEnd(Math.max(decimals, 0), "0").slice(0, Math.max(decimals, 0));
  const minor = Number(wholeRaw || "0") * 10 ** Math.max(decimals, 0) + Number(fraction || "0");
  if (!Number.isFinite(minor)) return null;
  const signed = negative ? -minor : minor;
  if (decimals === 2) return signed;
  if (decimals < 2) return signed * 10 ** (2 - decimals);
  return Math.round(signed / 10 ** (decimals - 2));
}

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
  amountCents: number | null;
  currency: string | null;
};

export function readWhopPaymentNotice(body: unknown): WhopPaymentNotice | null {
  const row = asRecord(body);
  if (!row) return null;
  const type = readString(row.type) || readString(row.event);
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = asRecord(row.data) ?? {};
  const metadata = asRecord(data.metadata);
  const orderId = readString(metadata?.orderId) || readString(metadata?.order_id);
  const paymentId = readString(data.id);
  if (!orderId || !paymentId) return null;
  const total = data.total ?? data.subtotal ?? data.presentment_total;
  const money = asRecord(total);
  const currency = readString(money?.currency) || readString(data.currency) || null;
  return {
    type,
    paymentId,
    orderId,
    amountCents: moneyToCents(total),
    currency,
  };
}
