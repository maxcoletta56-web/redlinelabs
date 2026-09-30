import { createHmac, timingSafeEqual } from "node:crypto";

/** Matches the Whop API version reported by the current docs and MCP. */
export const WHOP_API_VERSION = "2026-09-25";

export const WHOP_API_HOSTS = {
  sandbox: "https://sandbox-api.whop.com/api/v1",
  production: "https://api.whop.com/api/v1",
} as const;

export const WHOP_CHECKOUT_LOADER = "https://js.whop.com/static/checkout/loader.js";

/**
 * Payment-mode 3DS follows the plan. `frictionless_if_required` is the
 * regular frictionless flow: a challenge runs when the processor asks for
 * one (including the sandbox 3DS card) and is skipped otherwise.
 * Payments of $1,000 or more are raised to `mandate_if_required` by Whop
 * unless `mandate_challenge` is selected.
 */
export const WHOP_THREE_DS_LEVEL = "frictionless_if_required";

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type WhopEnvironment = "sandbox" | "production";

export type WhopEnv = {
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_COMPANY_ID?: string;
  WHOP_ENVIRONMENT?: string;
  WHOP_ENV?: string;
  [key: string]: string | undefined;
};

export type WhopConfig = {
  apiKey: string;
  companyId: string;
  environment: WhopEnvironment;
  apiBase: string;
};

export class WhopSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopSignatureError";
  }
}

/** Sandbox unless the operator explicitly selects production or live. */
export function whopEnvironment(env: WhopEnv = process.env): WhopEnvironment {
  const requested = (env.WHOP_ENVIRONMENT ?? env.WHOP_ENV ?? "").trim().toLowerCase();
  if (requested === "production" || requested === "live") return "production";
  return "sandbox";
}

export function resolveWhopConfig(env: WhopEnv = process.env): WhopConfig | null {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) return null;
  if (apiKey.startsWith("NEXT_PUBLIC_") || companyId.startsWith("NEXT_PUBLIC_")) return null;
  const environment = whopEnvironment(env);
  return {
    apiKey,
    companyId,
    environment,
    apiBase: WHOP_API_HOSTS[environment],
  };
}

/** Dollars for Whop `initial_price`. Integer cents stay exact to two places. */
export function centsToAudAmount(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export type CheckoutConfigurationInput = {
  orderId: string;
  amountCents: number;
  returnUrl: string;
  title: string;
};

export function checkoutConfigurationBody(config: WhopConfig, input: CheckoutConfigurationInput) {
  return {
    mode: "payment" as const,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      company_id: config.companyId,
      account_id: config.companyId,
      currency: "aud",
      initial_price: centsToAudAmount(input.amountCents),
      renewal_price: 0,
      plan_type: "one_time" as const,
      release_method: "buy_now" as const,
      visibility: "hidden" as const,
      force_create_new_plan: true,
      adaptive_pricing_enabled: false,
      three_ds_level: WHOP_THREE_DS_LEVEL,
      title: input.title,
      payment_method_configuration: {
        enabled: ["card"],
        disabled: [] as string[],
        include_platform_defaults: false,
      },
      product: {
        external_identifier: "redline-labs-order",
        title: "Redline Labs order",
        visibility: "hidden" as const,
        collect_shipping_address: false,
      },
    },
  };
}

export type CreatedCheckout = {
  sessionId: string;
  planId: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function readCreatedCheckout(payload: unknown): CreatedCheckout | null {
  const row = asRecord(payload);
  const sessionId = typeof row?.id === "string" ? row.id : "";
  const plan = asRecord(row?.plan);
  const planId = typeof plan?.id === "string" ? plan.id : "";
  if (!/^ch_[A-Za-z0-9]+$/.test(sessionId) || !/^plan_[A-Za-z0-9]+$/.test(planId)) {
    return null;
  }
  return { sessionId, planId };
}

function redact(value: string) {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:whsec|ws|apikey)_[A-Za-z0-9_-]+/gi, "[redacted]")
    .slice(0, 300);
}

export async function createCheckoutConfiguration(
  config: WhopConfig,
  input: CheckoutConfigurationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedCheckout> {
  const response = await fetchImpl(`${config.apiBase}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": WHOP_API_VERSION,
    },
    body: JSON.stringify(checkoutConfigurationBody(config, input)),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed with HTTP ${response.status}: ${redact(text)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Whop checkout configuration returned invalid JSON");
  }
  const created = readCreatedCheckout(parsed);
  if (!created) {
    throw new Error("Whop checkout configuration did not return a session and plan");
  }
  return created;
}

/**
 * HMAC keys for a Whop webhook secret.
 * `ws_` sandbox secrets are used as the raw string. `whsec_` secrets follow
 * Standard Webhooks and are base64 after the prefix. Both derivations are
 * tried so a dashboard secret of either shape verifies.
 */
export function webhookSecretKeys(secret: string): Buffer[] {
  const trimmed = secret.trim();
  const keys: Buffer[] = [];
  const push = (key: Buffer) => {
    if (key.length === 0) return;
    if (keys.some((existing) => existing.equals(key))) return;
    keys.push(key);
  };
  push(Buffer.from(trimmed));
  const prefixed = /^(?:whsec_|ws_)([A-Za-z0-9+/=_-]+)$/.exec(trimmed);
  if (prefixed) {
    push(Buffer.from(prefixed[1], "base64"));
  }
  return keys;
}

export type WebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export function readWebhookHeaders(headers: Headers): WebhookHeaders | null {
  const id = headers.get("webhook-id")?.trim() ?? "";
  const timestamp = headers.get("webhook-timestamp")?.trim() ?? "";
  const signature = headers.get("webhook-signature")?.trim() ?? "";
  if (!id || !timestamp || !signature) return null;
  if (id.includes(".") || timestamp.includes(".")) return null;
  return { id, timestamp, signature };
}

function signaturesMatch(expected: string, provided: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(provided);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Standard Webhooks signature over `{id}.{timestamp}.{rawBody}`.
 * Rejects timestamps more than five minutes from `now` to stop replays.
 */
export function verifyWhopWebhook(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  nowMs = Date.now(),
): void {
  const timestamp = Number(headers.timestamp);
  if (!Number.isFinite(timestamp)) {
    throw new WhopSignatureError("Invalid webhook timestamp");
  }
  const skewSeconds = Math.abs(nowMs / 1000 - timestamp);
  if (skewSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new WhopSignatureError("Webhook timestamp is outside the allowed window");
  }
  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const keys = webhookSecretKeys(secret);
  if (keys.length === 0) {
    throw new WhopSignatureError("Webhook secret is empty");
  }
  const candidates = headers.signature
    .split(" ")
    .map((part) => part.trim())
    .filter((part) => part.startsWith("v1,"))
    .map((part) => part.slice(3));
  if (candidates.length === 0) {
    throw new WhopSignatureError("Webhook signature is missing");
  }
  const matched = keys.some((key) => {
    const expected = createHmac("sha256", key).update(signed).digest("base64");
    return candidates.some((candidate) => signaturesMatch(expected, candidate));
  });
  if (!matched) {
    throw new WhopSignatureError("Webhook signature does not match");
  }
}

export type WhopPaymentEvent = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
};

export function readPaymentEvent(payload: unknown): WhopPaymentEvent | null {
  const row = asRecord(payload);
  const type = row?.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = asRecord(row?.data);
  if (!data) return null;
  const paymentId = typeof data.id === "string" ? data.id : "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) return null;
  const metadata = asRecord(data.metadata);
  const orderRaw = metadata?.orderId ?? metadata?.order_id;
  const orderId = typeof orderRaw === "string" ? orderRaw.trim() : "";
  if (!orderId) return null;
  return { type, paymentId, orderId };
}
