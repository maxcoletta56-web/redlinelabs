import { createHmac, timingSafeEqual } from "node:crypto";

/** Sandbox until WHOP_ENV is exactly `production`. Test cards never move live money. */
export type WhopEnvironment = "sandbox" | "production";

export type WhopEnv = {
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_COMPANY_ID?: string;
  WHOP_ENV?: string;
  [key: string]: string | undefined;
};

const PAYMENT_ID = /^pay_[A-Za-z0-9_-]{4,80}$/;
const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export class WhopWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopWebhookError";
  }
}

export function whopEnvironment(env: WhopEnv = process.env): WhopEnvironment {
  return env.WHOP_ENV?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function whopApiBase(environment: WhopEnvironment) {
  return environment === "production"
    ? "https://api.whop.com/api/v1"
    : "https://sandbox-api.whop.com/api/v1";
}

export function whopConfigured(env: WhopEnv = process.env) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim() && env.WHOP_WEBHOOK_SECRET?.trim());
}

/** Dollars for Whop `initial_price`, from integer cents. 19800 becomes 198. */
export function centsToAudAmount(cents: number) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2));
}

/**
 * Inline one-time plan in AUD. The price is the server total. Metadata carries
 * the order reference as `orderId` (and `order_id`, which Whop's examples use).
 */
export function whopCheckoutConfigurationBody(input: {
  companyId: string;
  reference: string;
  totalCents: number;
  returnUrl: string;
}) {
  return {
    mode: "payment" as const,
    metadata: {
      orderId: input.reference,
      order_id: input.reference,
    },
    redirect_url: input.returnUrl,
    plan: {
      company_id: input.companyId,
      currency: "aud" as const,
      plan_type: "one_time" as const,
      initial_price: centsToAudAmount(input.totalCents),
      force_create_new_plan: true,
      title: `Order ${input.reference}`,
      payment_method_configuration: {
        enabled: ["card"],
        disabled: [] as string[],
        include_platform_defaults: false,
      },
      product: {
        external_identifier: "redline-labs-order",
        title: "Redline Labs order",
        visibility: "hidden" as const,
        custom_statement_descriptor: "REDLINE LABS",
      },
    },
  };
}

export type WhopCheckoutConfig = {
  sessionId: string;
  planId: string;
};

export function readWhopCheckoutConfig(value: unknown): WhopCheckoutConfig | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sessionId = typeof row.id === "string" ? row.id : "";
  const plan = row.plan;
  const planId =
    plan && typeof plan === "object" && typeof (plan as { id?: unknown }).id === "string"
      ? (plan as { id: string }).id
      : "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) return null;
  return { sessionId, planId };
}

function headerValue(headers: Headers | Record<string, string | undefined>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? "";
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name);
  const value = match?.[1] ?? "";
  return Array.isArray(value) ? value.join(",") : value;
}

/**
 * Verifies a Whop webhook. The HMAC key is the secret's raw UTF-8 bytes,
 * prefix included. Whop signs `{webhook-id}.{webhook-timestamp}.{raw body}`.
 * The signature header is one or more space-separated `v1,<base64>` values.
 * Timestamps more than five minutes off are rejected.
 */
export function unwrapWhopWebhook(payload: string, headers: Headers | Record<string, string | undefined>, key: string | undefined, now = Date.now()): unknown {
  if (!key?.trim()) {
    throw new WhopWebhookError("Cannot verify a webhook without a key.");
  }
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new WhopWebhookError("Missing webhook signature headers");
  }
  if (!/^\d+$/.test(timestamp)) {
    throw new WhopWebhookError("Invalid webhook timestamp");
  }
  const seconds = Number(timestamp);
  if (Math.abs(now / 1000 - seconds) > TIMESTAMP_TOLERANCE_SECONDS) {
    throw new WhopWebhookError("Webhook timestamp is outside the tolerance window");
  }
  const expected = createHmac("sha256", key.trim()).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const expectedBytes = Buffer.from(expected);
  const matched = signature.split(" ").some((part) => {
    if (!part.startsWith("v1,")) return false;
    const value = part.slice(3);
    const actual = Buffer.from(value);
    if (actual.length !== expectedBytes.length) return false;
    return timingSafeEqual(actual, expectedBytes);
  });
  if (!matched) {
    throw new WhopWebhookError("Webhook signature does not match");
  }
  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new WhopWebhookError("Webhook body is not JSON");
  }
}

export type WhopPaymentEvent = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderReference: string;
  amountCents: number | null;
  currency: string;
};

function readRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readMoney(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

/** Gross amount in cents. `amount_after_fees` is Whop's net and is ignored. */
export function paymentAmountCents(data: Record<string, unknown>) {
  const gross = readMoney(data.total) ?? readMoney(data.subtotal);
  if (gross === null) return null;
  return Math.round(gross * 100);
}

export function readWhopPaymentEvent(value: unknown): WhopPaymentEvent | null {
  const event = readRecord(value);
  const data = readRecord(event?.data);
  if (!event || !data) return null;
  const type = event.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const paymentId = typeof data.id === "string" ? data.id : "";
  if (!PAYMENT_ID.test(paymentId)) return null;
  const metadata = readRecord(data.metadata);
  const orderReference = metadata?.orderId ?? metadata?.order_id;
  if (typeof orderReference !== "string" || !orderReference.trim()) return null;
  const currency = typeof data.currency === "string" ? data.currency.trim().toLowerCase() : "";
  return {
    type,
    paymentId,
    orderReference,
    amountCents: paymentAmountCents(data),
    currency,
  };
}
