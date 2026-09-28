import { createHmac, timingSafeEqual } from "node:crypto";

import { normalizeOrderReference } from "./order-reference.ts";

export type WhopEnvironment = "sandbox" | "production";

export type WhopConfig = {
  apiKey: string;
  webhookSecret: string;
  environment: WhopEnvironment;
  companyId: string | null;
  productId: string | null;
};

export class WhopSignatureError extends Error {
  constructor(message = "Invalid webhook signature") {
    super(message);
    this.name = "WhopSignatureError";
  }
}

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

/** Sandbox unless WHOP_ENV is live or production. Card testing uses sandbox keys. */
export function resolveWhopEnvironment(
  value: string | null | undefined,
): WhopEnvironment {
  const requested = value?.trim().toLowerCase() ?? "";
  return requested === "live" || requested === "production" ? "production" : "sandbox";
}

export function whopApiBaseUrl(environment: WhopEnvironment) {
  return environment === "production"
    ? "https://api.whop.com/api/v1"
    : "https://sandbox-api.whop.com/api/v1";
}

/**
 * Both secrets are required before card checkout is offered. The API key
 * creates the session; the webhook secret is what marks the order paid.
 */
export function resolveWhop(
  env: Record<string, string | undefined>,
): WhopConfig | undefined {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const webhookSecret = env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!apiKey || !webhookSecret) return undefined;
  const companyId = env.WHOP_COMPANY_ID?.trim() || null;
  const productId = env.WHOP_PRODUCT_ID?.trim() || null;
  return {
    apiKey,
    webhookSecret,
    environment: resolveWhopEnvironment(env.WHOP_ENV),
    companyId,
    productId,
  };
}

export function centsToAud(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function audToCents(amount: number) {
  return Math.round(amount * 100);
}

export type WhopCheckoutPayloadInput = {
  orderId: string;
  totalCents: number;
  returnUrl: string;
  companyId: string | null;
  productId: string | null;
};

/**
 * Inline plan priced in AUD. `three_ds_level` follows Whop’s plan policy:
 * frictionless unless the processor requires a challenge (the sandbox card
 * 5385 3083 6013 5181). The embedded element drives that challenge.
 */
export function whopCheckoutPayload(input: WhopCheckoutPayloadInput) {
  const plan: Record<string, unknown> = {
    currency: "aud",
    initial_price: centsToAud(input.totalCents),
    plan_type: "one_time",
    release_method: "buy_now",
    force_create_new_plan: true,
    three_ds_level: "frictionless_if_required",
    payment_method_configuration: {
      enabled: ["card"],
      include_platform_defaults: false,
    },
  };
  if (input.companyId) plan.account_id = input.companyId;
  if (input.productId) plan.product_id = input.productId;

  const body: Record<string, unknown> = {
    mode: "payment",
    plan,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
  };
  if (input.companyId) body.account_id = input.companyId;
  return body;
}

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readWhopCheckoutSession(body: unknown): WhopCheckoutSession {
  const row = asRecord(body);
  const sessionId = readString(row?.id);
  const planId = readString(asRecord(row?.plan)?.id);
  if (!sessionId || !planId) {
    throw new Error("Whop did not return a checkout session");
  }
  return { sessionId, planId };
}

export function whopErrorMessage(body: unknown) {
  const row = asRecord(body);
  const nested = asRecord(row?.error);
  const message = readString(nested?.message) || readString(row?.message);
  return message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]").slice(0, 300);
}

export async function createWhopCheckoutConfiguration(
  config: WhopConfig,
  input: WhopCheckoutPayloadInput,
  fetchImpl: typeof fetch = fetch,
): Promise<WhopCheckoutSession> {
  const response = await fetchImpl(`${whopApiBaseUrl(config.environment)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.orderId,
    },
    body: JSON.stringify(whopCheckoutPayload(input)),
  });
  const text = await response.text();
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    const detail = whopErrorMessage(parsed);
    throw new Error(detail || `Whop checkout failed (${response.status})`);
  }
  return readWhopCheckoutSession(parsed);
}

function webhookSecretKey(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const key = Buffer.from(encoded, "base64");
  if (key.length === 0) throw new WhopSignatureError("Webhook secret is empty");
  return key;
}

function signaturesMatch(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Standard Webhooks, as Whop documents them: signed content is
 * `{webhook-id}.{webhook-timestamp}.{raw body}`, HMAC-SHA256, base64.
 */
export function verifyWhopWebhook(input: {
  body: string;
  headers: Headers;
  secret: string;
  nowMs?: number;
}): unknown {
  const id = input.headers.get("webhook-id")?.trim() ?? "";
  const timestamp = input.headers.get("webhook-timestamp")?.trim() ?? "";
  const signature = input.headers.get("webhook-signature")?.trim() ?? "";
  if (!id || !timestamp || !signature) throw new WhopSignatureError("Missing webhook signature");

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) throw new WhopSignatureError("Invalid webhook timestamp");
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(nowSeconds - seconds) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new WhopSignatureError("Webhook timestamp is outside the tolerance");
  }

  const expected = createHmac("sha256", webhookSecretKey(input.secret))
    .update(`${id}.${timestamp}.${input.body}`)
    .digest("base64");
  const candidates = signature
    .split(" ")
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));
  if (!candidates.some((candidate) => signaturesMatch(candidate, expected))) {
    throw new WhopSignatureError();
  }

  try {
    return JSON.parse(input.body) as unknown;
  } catch {
    throw new WhopSignatureError("Webhook body is not JSON");
  }
}

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
  currency: string;
  total: number | null;
};

export type ParsedWhopEvent =
  | { kind: "ignore" }
  | { kind: "invalid" }
  | { kind: "payment"; notice: WhopPaymentNotice };

const PAYMENT_ID = /^pay_[A-Za-z0-9]{4,64}$/;

export function parseWhopWebhook(payload: unknown): ParsedWhopEvent {
  const row = asRecord(payload);
  const type = readString(row?.type);
  if (type !== "payment.succeeded" && type !== "payment.failed") return { kind: "ignore" };
  const data = asRecord(row?.data);
  const paymentId = readString(data?.id);
  const metadata = asRecord(data?.metadata);
  const orderId =
    normalizeOrderReference(readString(metadata?.orderId)) ??
    normalizeOrderReference(readString(metadata?.order_id));
  if (!PAYMENT_ID.test(paymentId) || !orderId) return { kind: "invalid" };
  const total = typeof data?.total === "number" && Number.isFinite(data.total) ? data.total : null;
  return {
    kind: "payment",
    notice: {
      type,
      paymentId,
      orderId,
      currency: readString(data?.currency).toLowerCase(),
      total,
    },
  };
}

/** `success` and `error` are the query values Whop appends to returnUrl. */
export function whopReturnStatus(value: string | null | undefined): "success" | "error" | "pending" {
  const status = value?.trim().toLowerCase();
  if (status === "success") return "success";
  if (status === "error") return "error";
  return "pending";
}

export function paymentAmountMatches(notice: WhopPaymentNotice, totalCents: number) {
  if (notice.currency !== "aud" || notice.total == null) return false;
  return audToCents(notice.total) === totalCents;
}
