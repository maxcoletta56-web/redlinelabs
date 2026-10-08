import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export type WhopEnvironment = "sandbox" | "production";

export type WhopEnv = Record<string, string | undefined>;

export type ResolvedWhop = {
  apiKey: string;
  webhookSecret: string | null;
  companyId: string | null;
  environment: WhopEnvironment;
};

export type WhopCheckoutConfig = {
  id: string;
  planId: string;
};

const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

/** Sandbox until WHOP_ENV is explicitly live, so a test key cannot charge real cards. */
export function whopEnvironment(env: WhopEnv): WhopEnvironment {
  const value = env.WHOP_ENV?.trim().toLowerCase() ?? "";
  if (value === "live" || value === "production") return "production";
  return "sandbox";
}

export function whopApiBase(environment: WhopEnvironment) {
  return environment === "production"
    ? "https://api.whop.com/api/v1"
    : "https://sandbox-api.whop.com/api/v1";
}

export function resolveWhop(env: WhopEnv): ResolvedWhop | null {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  const companyId = env.WHOP_COMPANY_ID?.trim() || null;
  return {
    apiKey,
    webhookSecret: env.WHOP_WEBHOOK_SECRET?.trim() || null,
    companyId,
    environment: whopEnvironment(env),
  };
}

/** Major units for Whop inline `initial_price`. 18000 cents is 180. */
export function audMajorUnits(amountCents: number) {
  return Number((Math.round(amountCents) / 100).toFixed(2));
}

export function majorUnitsToCents(value: unknown): number | null {
  const amount = typeof value === "string" ? Number(value) : value;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) return null;
  return Math.round(Number(amount.toFixed(2)) * 100);
}

export function buildCheckoutConfigurationBody(input: {
  orderId: string;
  amountCents: number;
  redirectUrl: string;
  companyId?: string | null;
}) {
  const plan: Record<string, unknown> = {
    title: `Redline Labs order ${input.orderId}`,
    plan_type: "one_time",
    currency: "aud",
    initial_price: audMajorUnits(input.amountCents),
    visibility: "hidden",
    force_create_new_plan: true,
    adaptive_pricing_enabled: false,
  };
  if (input.companyId) plan.company_id = input.companyId;
  return {
    mode: "payment" as const,
    metadata: { orderId: input.orderId },
    redirect_url: input.redirectUrl,
    plan,
  };
}

export function readCheckoutConfiguration(payload: unknown): WhopCheckoutConfig | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const id = row.id;
  const plan = row.plan;
  const planId =
    plan && typeof plan === "object" ? (plan as Record<string, unknown>).id : row.plan_id;
  if (typeof id !== "string" || !id.startsWith("ch_")) return null;
  if (typeof planId !== "string" || !planId.startsWith("plan_")) return null;
  return { id, planId };
}

function webhookKey(secret: string) {
  if (secret.startsWith("whsec_")) {
    return Buffer.from(secret.slice("whsec_".length), "base64");
  }
  return Buffer.from(secret, "utf8");
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Standard Webhooks: HMAC-SHA256 of `{id}.{timestamp}.{raw body}`, base64,
 * compared with `webhook-signature: v1,...`. `whsec_` secrets are base64 keys.
 * Current `ws_` secrets are the key as issued.
 */
export function verifyWhopWebhook(input: {
  secret: string;
  body: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  now?: number;
}) {
  const secret = input.secret.trim();
  if (!secret || !input.id || !input.timestamp || !input.signature) return false;
  if (!/^\d+$/.test(input.timestamp)) return false;
  const timestampMs = Number(input.timestamp) * 1000;
  const now = input.now ?? Date.now();
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > WEBHOOK_TOLERANCE_MS) {
    return false;
  }
  const expected = createHmac("sha256", webhookKey(secret))
    .update(`${input.id}.${input.timestamp}.${input.body}`)
    .digest("base64");
  return input.signature.split(" ").some((part) => {
    const separator = part.indexOf(",");
    if (separator <= 0) return false;
    const version = part.slice(0, separator);
    const signature = part.slice(separator + 1);
    return version === "v1" && safeEqual(signature, expected);
  });
}

export type WhopWebhookEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

export function parseWhopWebhookEvent(body: string): WhopWebhookEvent | null {
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    const row = parsed as Record<string, unknown>;
    const data = row.data;
    if (typeof row.type !== "string" || !data || typeof data !== "object" || Array.isArray(data)) {
      return null;
    }
    return {
      id: typeof row.id === "string" ? row.id : "",
      type: row.type,
      data: data as Record<string, unknown>,
    };
  } catch {
    return null;
  }
}

export function whopOrderIdFromMetadata(data: Record<string, unknown>) {
  const metadata = data.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const row = metadata as Record<string, unknown>;
  const value = row.orderId ?? row.order_id;
  return typeof value === "string" ? value : null;
}

export function whopPaymentAmountCents(data: Record<string, unknown>) {
  return majorUnitsToCents(data.total ?? data.subtotal);
}

function redactWhopError(body: string) {
  return body
    .replace(/apik_[A-Za-z0-9_-]+/g, "apik_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

export async function createWhopCheckoutConfiguration(
  config: ResolvedWhop,
  input: { orderId: string; amountCents: number; redirectUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<WhopCheckoutConfig> {
  const response = await fetchImpl(`${whopApiBase(config.environment)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      buildCheckoutConfigurationBody({
        ...input,
        companyId: config.companyId,
      }),
    ),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status}): ${redactWhopError(text)}`);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error("Whop checkout configuration was not JSON");
  }
  const checkout = readCheckoutConfiguration(payload);
  if (!checkout) throw new Error("Whop did not return a checkout session");
  return checkout;
}
