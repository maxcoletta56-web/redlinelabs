import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export type WhopWebhookPayment = {
  id: string;
  orderId: string;
  currency: string | null;
  total: number | null;
};

export type WhopWebhookEvent = {
  id: string;
  type: string;
  payment: WhopWebhookPayment | null;
};

function headerValue(headers: Headers | Record<string, string | undefined>, name: string) {
  if (headers instanceof Headers) return headers.get(name);
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? null;
  }
  return null;
}

/**
 * Standard Webhooks key: the secret Whop shows is `whsec_…` or `ws_…`, and
 * the HMAC key is the base64 payload after that prefix. A helper that instead
 * uses the raw secret string is also accepted so either published form verifies.
 */
export function whopWebhookKeys(secret: string): Buffer[] {
  const trimmed = secret.trim();
  const keys: Buffer[] = [];
  const prefixed = /^(?:whsec_|ws_)([\s\S]+)$/.exec(trimmed);
  if (prefixed?.[1]) {
    const decoded = decodeBase64(prefixed[1]);
    if (decoded) keys.push(decoded);
  }
  keys.push(Buffer.from(trimmed, "utf8"));
  return keys;
}

function decodeBase64(value: string) {
  try {
    const buffer = Buffer.from(value, "base64");
    if (buffer.length === 0) return null;
    return buffer;
  } catch {
    return null;
  }
}

function signaturesMatch(expected: Buffer, candidates: string[]) {
  for (const candidate of candidates) {
    const [version, encoded] = candidate.split(",", 2);
    if (version !== "v1" || !encoded) continue;
    const received = decodeBase64(encoded);
    if (!received || received.length !== expected.length) continue;
    if (timingSafeEqual(expected, received)) return true;
  }
  return false;
}

export function verifyWhopWebhook(input: {
  payload: string;
  headers: Headers | Record<string, string | undefined>;
  secret: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const secret = input.secret.trim();
  if (!secret) return { ok: false, reason: "missing_secret" };

  const id = headerValue(input.headers, "webhook-id")?.trim() ?? "";
  const timestampRaw = headerValue(input.headers, "webhook-timestamp")?.trim() ?? "";
  const signatureHeader = headerValue(input.headers, "webhook-signature")?.trim() ?? "";
  if (!id || !timestampRaw || !signatureHeader) return { ok: false, reason: "missing_headers" };

  const timestamp = Number(timestampRaw);
  if (!Number.isFinite(timestamp)) return { ok: false, reason: "bad_timestamp" };
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  const tolerance = input.toleranceSeconds ?? TOLERANCE_SECONDS;
  if (Math.abs(nowSeconds - timestamp) > tolerance) return { ok: false, reason: "stale_timestamp" };

  const signed = `${id}.${timestampRaw}.${input.payload}`;
  const presented = signatureHeader.split(" ").filter(Boolean);
  const matched = whopWebhookKeys(secret).some((key) => {
    const expected = createHmac("sha256", key).update(signed).digest();
    return signaturesMatch(expected, presented);
  });
  if (!matched) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

function readOrderId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const record = metadata as Record<string, unknown>;
  const orderId = record.orderId ?? record.order_id;
  return typeof orderId === "string" ? orderId.trim() : "";
}

function readTotal(data: Record<string, unknown>) {
  const raw = data.total ?? data.subtotal ?? data.initial_price;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

/** Parses a verified body. Payment events without an id or orderId stay unscoped. */
export function parseWhopWebhook(payload: string): WhopWebhookEvent | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const record = parsed as Record<string, unknown>;
  const type = typeof record.type === "string" ? record.type : "";
  if (!type) return null;
  const data = record.data;
  const row = data && typeof data === "object" && !Array.isArray(data) ? (data as Record<string, unknown>) : null;
  const paymentId = typeof row?.id === "string" ? row.id.trim() : "";
  const orderId = readOrderId(row?.metadata);
  const currency = typeof row?.currency === "string" ? row.currency : null;
  const payment =
    paymentId && orderId
      ? { id: paymentId, orderId, currency, total: row ? readTotal(row) : null }
      : null;
  return {
    id: typeof record.id === "string" ? record.id : "",
    type,
    payment,
  };
}

export type WhopWebhookResponse = {
  status: number;
  body: { received: true; outcome?: string; reason?: string } | { error: string };
};

/**
 * Verifies the raw body, then settles `payment.succeeded` and `payment.failed`.
 * Other event types return 200 so Whop does not retry them. The settle function
 * owns idempotency on the Whop payment id.
 */
export async function handleWhopWebhook(input: {
  raw: string;
  headers: Headers | Record<string, string | undefined>;
  secret: string | undefined;
  nowMs?: number;
  settle: (event: WhopWebhookEvent & { payment: WhopWebhookPayment }) => Promise<{ outcome: string }>;
}): Promise<WhopWebhookResponse> {
  const secret = input.secret?.trim() ?? "";
  if (!secret) return { status: 500, body: { error: "webhook secret is not configured" } };

  const verified = verifyWhopWebhook({
    payload: input.raw,
    headers: input.headers,
    secret,
    nowMs: input.nowMs,
  });
  if (!verified.ok) return { status: 401, body: { error: "bad signature" } };

  const event = parseWhopWebhook(input.raw);
  if (!event) return { status: 400, body: { error: "invalid payload" } };
  if (event.type !== "payment.succeeded" && event.type !== "payment.failed") {
    return { status: 200, body: { received: true, outcome: "ignored" } };
  }
  if (!event.payment) {
    return { status: 200, body: { received: true, outcome: "ignored", reason: "missing_order" } };
  }

  try {
    const result = await input.settle({ ...event, payment: event.payment });
    return { status: 200, body: { received: true, outcome: result.outcome } };
  } catch (error) {
    console.error("[whop] webhook settle failed", {
      type: event.type,
      paymentId: event.payment.id,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { status: 500, body: { error: "settle failed" } };
  }
}
