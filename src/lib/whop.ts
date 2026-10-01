import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Sandbox until WHOP_ENV is explicitly live, so a missing flag cannot charge real cards. */
export type WhopMode = "sandbox" | "live";

export type WhopEmbedEnvironment = "sandbox" | "production";

const SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
const LIVE_API = "https://api.whop.com/api/v1";

/** Standard Webhooks tolerance. Older or future-dated deliveries are rejected. */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WhopEnv = {
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_ENV?: string;
  WHOP_COMPANY_ID?: string;
  WHOP_PRODUCT_ID?: string;
  [key: string]: string | undefined;
};

export function whopMode(env: WhopEnv = process.env): WhopMode {
  const requested = env.WHOP_ENV?.trim().toLowerCase() ?? "";
  return requested === "live" || requested === "production" ? "live" : "sandbox";
}

export function whopEmbedEnvironment(env: WhopEnv = process.env): WhopEmbedEnvironment {
  return whopMode(env) === "live" ? "production" : "sandbox";
}

export function whopApiBase(env: WhopEnv = process.env) {
  return whopMode(env) === "live" ? LIVE_API : SANDBOX_API;
}

export function whopApiKey(env: WhopEnv = process.env) {
  return env.WHOP_API_KEY?.trim() ?? "";
}

export function whopConfigured(env: WhopEnv = process.env) {
  return whopApiKey(env).length > 0;
}

/** AUD dollars for Whop `initial_price`. Integer cents stay the source of truth. */
export function centsToAud(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export type WhopCheckoutBody = {
  account_id?: string;
  mode: "payment";
  redirect_url: string;
  metadata: { orderId: string };
  currency: "aud";
  payment_method_configuration: {
    enabled: ["card"];
    include_platform_defaults: false;
  };
  plan: {
    account_id?: string;
    product_id?: string;
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    force_create_new_plan: true;
    visibility: "hidden";
    release_method: "buy_now";
    unlimited_stock: true;
    title: string;
    three_ds_level: "frictionless_if_required";
    payment_method_configuration: {
      enabled: ["card"];
      include_platform_defaults: false;
    };
  };
};

/**
 * Inline plan priced in AUD. `three_ds_level` follows Whop's frictionless flow:
 * the issuer can still challenge the card, and payments of $1,000 or more are
 * stepped up by Whop. The embedded element completes that challenge.
 */
export function whopCheckoutBody(input: {
  totalCents: number;
  orderId: string;
  redirectUrl: string;
  title: string;
  accountId?: string | null;
  productId?: string | null;
}): WhopCheckoutBody {
  const accountId = input.accountId?.trim() || undefined;
  const productId = input.productId?.trim() || undefined;
  const cardOnly = {
    enabled: ["card"] as ["card"],
    include_platform_defaults: false as const,
  };
  return {
    ...(accountId ? { account_id: accountId } : {}),
    mode: "payment",
    redirect_url: input.redirectUrl,
    metadata: { orderId: input.orderId },
    currency: "aud",
    payment_method_configuration: cardOnly,
    plan: {
      ...(accountId ? { account_id: accountId } : {}),
      ...(productId ? { product_id: productId } : {}),
      currency: "aud",
      initial_price: centsToAud(input.totalCents),
      plan_type: "one_time",
      force_create_new_plan: true,
      visibility: "hidden",
      release_method: "buy_now",
      unlimited_stock: true,
      title: input.title,
      three_ds_level: "frictionless_if_required",
      payment_method_configuration: cardOnly,
    },
  };
}

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
};

type FetchImpl = typeof fetch;

export async function createWhopCheckoutConfiguration(
  body: WhopCheckoutBody,
  idempotencyKey: string,
  env: WhopEnv = process.env,
  fetchImpl: FetchImpl = fetch,
): Promise<WhopCheckoutSession> {
  const apiKey = whopApiKey(env);
  if (!apiKey) throw new Error("Card checkout is not configured");

  const response = await fetchImpl(`${whopApiBase(env)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Whop checkout could not be started (${response.status})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Whop checkout returned an unreadable session");
  }
  const record = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const sessionId = typeof record?.id === "string" ? record.id : "";
  const plan = record?.plan && typeof record.plan === "object" ? (record.plan as Record<string, unknown>) : null;
  const planId = typeof plan?.id === "string" ? plan.id : "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop checkout did not return a session");
  }
  return { sessionId, planId };
}

function headerValue(headers: Headers | Record<string, string>, name: string) {
  if (headers instanceof Headers) return headers.get(name)?.trim() ?? "";
  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  return found?.[1]?.trim() ?? "";
}

function hmacKeys(secret: string) {
  const trimmed = secret.trim();
  const keys = [Buffer.from(trimmed, "utf8")];
  const prefixed = /^(?:whsec_|ws_)(.+)$/.exec(trimmed);
  if (prefixed) {
    const decoded = Buffer.from(prefixed[1], "base64");
    if (decoded.length > 0) keys.push(decoded);
  }
  return keys;
}

function signatureMatches(signed: string, header: string, key: Buffer) {
  const expected = createHmac("sha256", key).update(signed).digest("base64");
  const expectedBytes = Buffer.from(expected);
  return header.split(" ").some((part) => {
    const comma = part.indexOf(",");
    if (comma === -1) return false;
    const version = part.slice(0, comma);
    const value = part.slice(comma + 1);
    if (version !== "v1" || !value) return false;
    const actual = Buffer.from(value);
    return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
  });
}

/**
 * Verifies a Standard Webhooks signature over the raw body. Whop signs
 * `${webhook-id}.${webhook-timestamp}.${body}`. The key is the webhook secret
 * itself, which is what the SDK uses after base64-encoding it for `webhookKey`.
 * A `whsec_` or `ws_` secret is also tried as base64 payload so either dashboard
 * format verifies.
 */
export function verifyWhopWebhook(
  rawBody: string,
  headers: Headers | Record<string, string>,
  secret: string,
  nowMs = Date.now(),
): unknown {
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature || !secret.trim()) {
    throw new Error("Missing webhook signature");
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) throw new Error("Invalid webhook timestamp");
  if (Math.abs(nowMs / 1000 - seconds) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp is outside the tolerance window");
  }
  const signed = `${id}.${timestamp}.${rawBody}`;
  const valid = hmacKeys(secret).some((key) => signatureMatches(signed, signature, key));
  if (!valid) throw new Error("Invalid webhook signature");
  return JSON.parse(rawBody) as unknown;
}

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** Pulls `metadata.orderId` off a payment webhook. Other events are ignored. */
export function readWhopPaymentEvent(payload: unknown): WhopPaymentNotice | null {
  const record = readRecord(payload);
  const type = record?.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = readRecord(record?.data);
  const paymentId = typeof data?.id === "string" ? data.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{4,80}$/.test(paymentId)) return null;
  const metadata = readRecord(data?.metadata);
  const orderId = typeof metadata?.orderId === "string" ? metadata.orderId.trim() : "";
  if (!orderId) return null;
  return { type, paymentId, orderId };
}
