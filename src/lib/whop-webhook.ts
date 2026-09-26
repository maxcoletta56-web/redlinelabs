import { createHmac, timingSafeEqual } from "node:crypto";
import { lineLabel } from "./order.ts";
import { formatPrice } from "./products.ts";
import {
  beginPaymentUpdate,
  completePaidEmail,
  type ServerOrder,
} from "./server-order.ts";
import type { OrderStore } from "./order-store.ts";

const TOLERANCE_SECONDS = 5 * 60;

export class WebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookSignatureError";
  }
}

function decodeBase64(value: string) {
  const normalized = value.trim();
  if (!normalized || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(normalized)) return null;
  try {
    const buffer = Buffer.from(normalized, "base64");
    if (buffer.length === 0) return null;
    return buffer;
  } catch {
    return null;
  }
}

/**
 * Keys accepted for the HMAC. Whop documents both a raw `ws_` / `whsec_` secret
 * used as UTF-8 and the Standard Webhooks form where the suffix is base64.
 * A request still has to match one of those derivations of the configured secret.
 */
export function webhookKeyCandidates(secret: string) {
  const trimmed = secret.trim();
  const keys = [Buffer.from(trimmed, "utf8")];
  const stripped = trimmed.replace(/^(whsec_|ws_)/, "");
  if (stripped !== trimmed) keys.push(Buffer.from(stripped, "utf8"));
  const decoded = decodeBase64(trimmed);
  if (decoded) keys.push(decoded);
  if (stripped !== trimmed) {
    const decodedSuffix = decodeBase64(stripped);
    if (decodedSuffix) keys.push(decodedSuffix);
  }
  return keys;
}

function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyWhopSignature(input: {
  rawBody: string;
  headers: Headers;
  secret: string;
  now?: number;
}) {
  const id = input.headers.get("webhook-id")?.trim() ?? "";
  const timestamp = input.headers.get("webhook-timestamp")?.trim() ?? "";
  const signature = input.headers.get("webhook-signature")?.trim() ?? "";
  if (!id || !timestamp || !signature) {
    throw new WebhookSignatureError("Missing webhook signature");
  }
  const seconds = Number(timestamp);
  const now = input.now ?? Math.floor(Date.now() / 1000);
  if (!Number.isFinite(seconds) || Math.abs(now - seconds) > TOLERANCE_SECONDS) {
    throw new WebhookSignatureError("Stale webhook timestamp");
  }

  const signed = `${id}.${timestamp}.${input.rawBody}`;
  const provided = signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter(Boolean);
  if (provided.length === 0) throw new WebhookSignatureError("Missing webhook signature");

  const matched = webhookKeyCandidates(input.secret).some((key) => {
    const expected = createHmac("sha256", key).update(signed).digest("base64");
    return provided.some((candidate) => signaturesMatch(expected, candidate));
  });
  if (!matched) throw new WebhookSignatureError("Invalid webhook signature");
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

export function confirmationEmail(order: ServerOrder) {
  const lines = order.lines
    .map((line) => `${lineLabel(line)} × ${line.qty} — ${formatPrice(line.unitAmountCents / 100)}`)
    .join("\n");
  const text = [
    `Redline Labs order ${order.id}`,
    "",
    "Your card payment was received.",
    "",
    lines,
    "",
    `Total: ${formatPrice(order.totalCents / 100)} AUD`,
    "",
    "This purchase is for laboratory research use only and is not for human consumption.",
    "Questions: redlinelabsltd@pm.me",
  ].join("\n");
  return {
    to: order.email,
    subject: `Redline Labs order ${order.id}`,
    text,
  };
}

export async function handleWhopWebhook(input: {
  rawBody: string;
  headers: Headers;
  secret: string;
  now?: number;
  store: OrderStore;
  sendEmail: (order: ServerOrder) => Promise<void>;
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

  const outcome = event.type === "payment.succeeded" ? "paid" : "failed";
  const update = beginPaymentUpdate(existing, event.paymentId, outcome);
  if (update.kind === "duplicate") {
    return { status: 200, body: { ok: true, duplicate: true } };
  }

  await input.store.put(update.order);
  if (update.kind === "failed") {
    return { status: 200, body: { ok: true, status: update.order.status } };
  }

  try {
    await input.sendEmail(update.order);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Confirmation email failed";
    return { status: 500, body: { ok: false, error: message } };
  }

  await input.store.put(completePaidEmail(update.order, event.paymentId));
  return { status: 200, body: { ok: true, status: "paid" } };
}
