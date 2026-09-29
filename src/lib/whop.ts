import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizeOrderReference } from "./order-reference.ts";

export const WHOP_SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
export const WHOP_PRODUCTION_API = "https://api.whop.com/api/v1";

/** Five minutes, matching the Standard Webhooks window Whop signs with. */
export const WHOP_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WhopEnvironment = "sandbox" | "production";

export type WhopEnv = {
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_COMPANY_ID?: string;
  WHOP_ENV?: string;
  DATABASE_URL?: string;
};

export function whopEnvironment(env?: WhopEnv): WhopEnvironment {
  const value = (env ?? process.env).WHOP_ENV?.trim().toLowerCase() ?? "";
  if (value === "production" || value === "live") return "production";
  return "sandbox";
}

export function whopApiBase(environment: WhopEnvironment) {
  return environment === "production" ? WHOP_PRODUCTION_API : WHOP_SANDBOX_API;
}

export function whopConfigured(env?: WhopEnv) {
  const source = env ?? process.env;
  return Boolean(
    source.WHOP_API_KEY?.trim() && source.WHOP_COMPANY_ID?.trim() && source.DATABASE_URL?.trim(),
  );
}

/** Dollars for Whop `initial_price`, from integer cents. 1995 becomes 19.95. */
export function centsToWhopPrice(cents: number) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2));
}

export function checkoutReturnUrl(origin: string, reference: string) {
  return `${origin.replace(/\/$/, "")}/checkout/return/${reference}`;
}

export function originFromHeaders(
  headerList: { get(name: string): string | null },
  fallback: string,
) {
  const host = (headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (!host) return fallback.replace(/\/$/, "");
  const forwarded = headerList.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwarded ||
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export type WhopCheckoutBody = {
  account_id: string;
  mode: "payment";
  metadata: { orderId: string };
  redirect_url: string;
  plan: {
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    force_create_new_plan: true;
    title: string;
    visibility: "hidden";
    release_method: "buy_now";
    three_ds_level: "frictionless_if_required";
    payment_method_configuration: {
      enabled: ["card"];
      include_platform_defaults: false;
    };
  };
  payment_method_configuration: {
    enabled: ["card"];
    include_platform_defaults: false;
  };
};

/**
 * Inline AUD price for one pending order. Payment mode follows the plan's
 * 3DS policy: `frictionless_if_required` challenges when the processor asks
 * (including the sandbox 3DS card) and otherwise stays frictionless.
 */
export function buildWhopCheckoutBody(input: {
  companyId: string;
  reference: string;
  totalCents: number;
  returnUrl: string;
}): WhopCheckoutBody {
  return {
    account_id: input.companyId,
    mode: "payment",
    metadata: { orderId: input.reference },
    redirect_url: input.returnUrl,
    plan: {
      currency: "aud",
      initial_price: centsToWhopPrice(input.totalCents),
      plan_type: "one_time",
      force_create_new_plan: true,
      title: `Redline Labs ${input.reference}`,
      visibility: "hidden",
      release_method: "buy_now",
      three_ds_level: "frictionless_if_required",
      payment_method_configuration: {
        enabled: ["card"],
        include_platform_defaults: false,
      },
    },
    payment_method_configuration: {
      enabled: ["card"],
      include_platform_defaults: false,
    },
  };
}

export type CreatedWhopCheckout = {
  sessionId: string;
  planId: string | null;
};

function readCheckoutIds(payload: unknown): CreatedWhopCheckout | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const sessionId = typeof record.id === "string" ? record.id : "";
  if (!/^ch_[A-Za-z0-9]+$/.test(sessionId)) return null;
  const plan = record.plan;
  const planId =
    plan && typeof plan === "object" && typeof (plan as { id?: unknown }).id === "string"
      ? (plan as { id: string }).id
      : null;
  if (planId && !/^plan_[A-Za-z0-9]+$/.test(planId)) return null;
  return { sessionId, planId };
}

export async function createWhopCheckoutConfiguration(
  input: {
    apiKey: string;
    companyId: string;
    environment: WhopEnvironment;
    reference: string;
    totalCents: number;
    returnUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedWhopCheckout> {
  const response = await fetchImpl(`${whopApiBase(input.environment)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `whop-order-${input.reference}`,
    },
    body: JSON.stringify(
      buildWhopCheckoutBody({
        companyId: input.companyId,
        reference: input.reference,
        totalCents: input.totalCents,
        returnUrl: input.returnUrl,
      }),
    ),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status})`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Whop checkout configuration returned invalid JSON");
  }
  const created = readCheckoutIds(parsed);
  if (!created) throw new Error("Whop checkout configuration did not return a session");
  return created;
}

export type WebhookVerification =
  | { ok: true }
  | { ok: false; reason: "missing" | "timestamp" | "expired" | "mismatch" };

/**
 * Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256.
 * The dashboard secret is the key bytes. A `whsec_` secret uses the standard
 * webhooks prefix and a base64 key after it.
 */
export function webhookSigningKey(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) return Buffer.from(trimmed.slice("whsec_".length), "base64");
  return Buffer.from(trimmed, "utf8");
}

export function verifyWhopWebhook(input: {
  rawBody: string;
  webhookId: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string;
  nowMs?: number;
}): WebhookVerification {
  const id = input.webhookId?.trim() ?? "";
  const timestamp = input.timestamp?.trim() ?? "";
  const signature = input.signature?.trim() ?? "";
  const secret = input.secret.trim();
  if (!id || !timestamp || !signature || !secret) return { ok: false, reason: "missing" };
  if (!/^\d+$/.test(timestamp)) return { ok: false, reason: "timestamp" };
  const stamp = Number(timestamp);
  const now = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (Math.abs(now - stamp) > WHOP_WEBHOOK_TOLERANCE_SECONDS) {
    return { ok: false, reason: "expired" };
  }

  const expected = createHmac("sha256", webhookSigningKey(secret))
    .update(`${id}.${timestamp}.${input.rawBody}`)
    .digest();
  const candidates = signature.split(" ").filter(Boolean);
  for (const candidate of candidates) {
    const comma = candidate.indexOf(",");
    if (comma <= 0) continue;
    if (candidate.slice(0, comma) !== "v1") continue;
    const given = Buffer.from(candidate.slice(comma + 1), "base64");
    if (given.length !== expected.length) continue;
    if (timingSafeEqual(given, expected)) return { ok: true };
  }
  return { ok: false, reason: "mismatch" };
}

export type WhopPaymentNotice = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
};

function metadataOrderId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const record = metadata as Record<string, unknown>;
  const raw = record.orderId ?? record.order_id;
  return typeof raw === "string" ? normalizeOrderReference(raw) : null;
}

/** Payment events we fulfill. Anything else is acknowledged and ignored. */
export function readWhopPaymentNotice(
  payload: unknown,
): WhopPaymentNotice | { ignore: true } | { invalid: true } {
  if (!payload || typeof payload !== "object") return { invalid: true };
  const type = (payload as { type?: unknown }).type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return { ignore: true };
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return { invalid: true };
  const record = data as Record<string, unknown>;
  const paymentId = typeof record.id === "string" ? record.id.trim() : "";
  if (!/^[A-Za-z0-9_]{4,80}$/.test(paymentId)) return { invalid: true };
  const orderId = metadataOrderId(record.metadata);
  if (!orderId) return { invalid: true };
  return { type, paymentId, orderId };
}
