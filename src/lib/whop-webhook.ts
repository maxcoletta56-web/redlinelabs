import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;
const PAYMENT_ID = /^pay_[A-Za-z0-9]+$/;

export type WhopWebhookEvent = {
  id: string;
  type: string;
  paymentId: string | null;
  orderId: string | null;
};

export class WhopWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopWebhookError";
  }
}

function headerValue(headers: Headers | Record<string, string | string[] | undefined>, name: string) {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name);
  }
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

/** Standard Webhooks secret. A `whsec_` prefix marks a base64 key. */
export function webhookSecretBytes(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    return Buffer.from(trimmed.slice("whsec_".length), "base64");
  }
  return Buffer.from(trimmed);
}

function signaturesMatch(expected: string, presented: string) {
  const parts = presented.split(" ").filter(Boolean);
  const expectedBytes = Buffer.from(expected);
  return parts.some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value);
    if (given.length !== expectedBytes.length) return false;
    return timingSafeEqual(given, expectedBytes);
  });
}

export function verifyWhopWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | string[] | undefined>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new WhopWebhookError("Missing webhook signature headers");
  }
  const issued = Number(timestamp);
  if (!Number.isFinite(issued) || Math.abs(nowSeconds - issued) > TOLERANCE_SECONDS) {
    throw new WhopWebhookError("Webhook timestamp is outside the tolerance window");
  }
  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", webhookSecretBytes(secret)).update(signed).digest("base64");
  if (!signaturesMatch(expected, signature)) {
    throw new WhopWebhookError("Webhook signature did not match");
  }
}

function readOrderId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return null;
  const row = metadata as Record<string, unknown>;
  const orderId = row.orderId ?? row.order_id;
  return typeof orderId === "string" && orderId.trim() ? orderId.trim() : null;
}

export function readWhopWebhookEvent(value: unknown): WhopWebhookEvent | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const type = typeof row.type === "string" ? row.type : "";
  const id = typeof row.id === "string" ? row.id : "";
  if (!type || !id) return null;
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null;
  const paymentId = typeof data?.id === "string" && PAYMENT_ID.test(data.id) ? data.id : null;
  return {
    id,
    type,
    paymentId,
    orderId: data ? readOrderId(data.metadata) : null,
  };
}

export function verifyAndReadWhopWebhook(
  rawBody: string,
  headers: Headers | Record<string, string | string[] | undefined>,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): WhopWebhookEvent {
  verifyWhopWebhook(rawBody, headers, secret, nowSeconds);
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new WhopWebhookError("Webhook body was not JSON");
  }
  const event = readWhopWebhookEvent(parsed);
  if (!event) throw new WhopWebhookError("Webhook body was not a Whop event");
  return event;
}
