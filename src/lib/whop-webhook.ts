import { createHmac, timingSafeEqual } from "node:crypto";
import type { OrderStore, StoredOrder } from "./orders.ts";

const TOLERANCE_SECONDS = 5 * 60;

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256.
 * The key is the webhook secret as UTF-8, including a `ws_` prefix.
 * `webhook-signature` is space-separated `v1,<base64>` values.
 */
export function verifyWhopSignature(input: {
  rawBody: string;
  headers: Headers;
  secret: string;
  now?: number;
}) {
  const id = input.headers.get("webhook-id")?.trim() ?? "";
  const timestamp = input.headers.get("webhook-timestamp")?.trim() ?? "";
  const signature = input.headers.get("webhook-signature")?.trim() ?? "";
  if (!id || !timestamp || !signature || !input.secret.trim()) {
    throw new WebhookSignatureError("Missing webhook signature");
  }
  const seconds = Number(timestamp);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > TOLERANCE_SECONDS) {
    throw new WebhookSignatureError("Stale webhook timestamp");
  }

  const signed = `${id}.${timestamp}.${input.rawBody}`;
  const expected = createHmac("sha256", Buffer.from(input.secret.trim(), "utf8"))
    .update(signed)
    .digest("base64");
  const provided = signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter(Boolean);
  if (provided.length === 0 || !provided.some((candidate) => signaturesMatch(expected, candidate))) {
    throw new WebhookSignatureError("Invalid webhook signature");
  }
}

export type ParsedWhopEvent =
  | { type: "payment.succeeded" | "payment.failed"; paymentId: string; orderId: string }
  | { type: "ignored" };

function readMetadataOrderId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const row = metadata as Record<string, unknown>;
  const orderId = row.orderId ?? row.order_id;
  return typeof orderId === "string" ? orderId.trim() : "";
}

export function parseWhopEvent(payload: unknown): ParsedWhopEvent {
  if (!payload || typeof payload !== "object") return { type: "ignored" };
  const row = payload as Record<string, unknown>;
  const type = row.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return { type: "ignored" };
  const data = row.data;
  if (!data || typeof data !== "object") return { type: "ignored" };
  const payment = data as Record<string, unknown>;
  const paymentId = typeof payment.id === "string" ? payment.id.trim() : "";
  const orderId = readMetadataOrderId(payment.metadata);
  if (!paymentId || !orderId) return { type: "ignored" };
  return { type, paymentId, orderId };
}

export async function handleWhopWebhook(input: {
  rawBody: string;
  headers: Headers;
  secret: string;
  now?: number;
  store: OrderStore;
  sendEmail: (order: StoredOrder) => Promise<void>;
}) {
  verifyWhopSignature({
    rawBody: input.rawBody,
    headers: input.headers,
    secret: input.secret,
    now: input.now,
  });

  let payload: unknown;
  try {
    payload = JSON.parse(input.rawBody) as unknown;
  } catch {
    return { status: 400, body: { ok: false, error: "Invalid webhook payload" } };
  }

  const event = parseWhopEvent(payload);
  if (event.type === "ignored") {
    return { status: 200, body: { ok: true, ignored: true } };
  }

  const existing = await input.store.get(event.orderId);
  if (!existing) {
    return { status: 404, body: { ok: false, error: "Order not found" } };
  }

  if (event.type === "payment.failed") {
    if (existing.status === "paid") {
      return { status: 200, body: { ok: true, ignored: true } };
    }
    if (existing.status === "failed" && existing.whopPaymentId === event.paymentId) {
      return { status: 200, body: { ok: true, duplicate: true } };
    }
    await input.store.markFailed(existing.id, event.paymentId);
    return { status: 200, body: { ok: true, status: "failed" } };
  }

  if (existing.whopPaymentId === event.paymentId && existing.confirmationSentAt) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }
  if (existing.status === "paid" && existing.whopPaymentId && existing.whopPaymentId !== event.paymentId) {
    return { status: 200, body: { ok: true, ignored: true } };
  }
  if (existing.status !== "paid") {
    await input.store.markPaid(existing.id, event.paymentId);
  }

  const claimed = await input.store.claimConfirmation(existing.id, event.paymentId);
  if (!claimed) {
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  try {
    const paid = await input.store.get(existing.id);
    if (!paid) return { status: 404, body: { ok: false, error: "Order not found" } };
    await input.sendEmail(paid);
  } catch (error) {
    await input.store.releaseConfirmation(existing.id, event.paymentId);
    const message = error instanceof Error ? error.message : "Confirmation email failed";
    return { status: 500, body: { ok: false, error: message } };
  }

  return { status: 200, body: { ok: true, status: "paid" } };
}
