import { createHmac, timingSafeEqual } from "node:crypto";

/** Reject deliveries signed more than five minutes from the server clock. */
export const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
};

type HeaderSource = { get(name: string): string | null };

/**
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256.
 * The key is the webhook secret as stored (`ws_...`). The SDK base64-encodes
 * that secret only because the Standard Webhooks verifier decodes it again,
 * so the HMAC key is the original secret string. Compare against every
 * `v1,` value in `webhook-signature`.
 */
export function verifyWhopWebhook(
  rawBody: string,
  headers: HeaderSource,
  secret: string,
  nowMs = Date.now(),
): unknown {
  const id = headers.get("webhook-id")?.trim() ?? "";
  const timestamp = headers.get("webhook-timestamp")?.trim() ?? "";
  const signature = headers.get("webhook-signature")?.trim() ?? "";
  const key = secret.trim();
  if (!id || !timestamp || !signature || !key) {
    throw new Error("Missing webhook signature");
  }

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) throw new Error("Invalid webhook timestamp");
  const drift = Math.abs(Math.floor(nowMs / 1000) - seconds);
  if (drift > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp is outside the tolerance window");
  }

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  const presented = signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter((part) => part.length > 0);
  const match = presented.some((candidate) => signaturesMatch(candidate, expected));
  if (!match) throw new Error("Invalid webhook signature");

  return JSON.parse(rawBody) as unknown;
}

function signaturesMatch(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pulls the payment id and the orderId we attached when creating the checkout. */
export function readWhopPaymentNotice(payload: unknown): WhopPaymentNotice | null {
  const event = readRecord(payload);
  if (!event) return null;
  const type = event.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = readRecord(event.data);
  const paymentId = typeof data?.id === "string" ? data.id.trim() : "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return null;
  const metadata = readRecord(data?.metadata);
  const orderId = typeof metadata?.orderId === "string" ? metadata.orderId.trim() : "";
  if (!orderId) return null;
  return { type, paymentId, orderId };
}

/** Builds a signature header for tests and local sandbox replays. */
export function signWhopWebhook(rawBody: string, secret: string, nowMs = Date.now(), id = "msg_test") {
  const timestamp = String(Math.floor(nowMs / 1000));
  const signature = createHmac("sha256", secret).update(`${id}.${timestamp}.${rawBody}`).digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": timestamp,
    "webhook-signature": `v1,${signature}`,
  };
}
