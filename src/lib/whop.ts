import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveCartLines, type CartLineInput } from "./order.ts";
import { lookupPromo, quoteFromSubtotal } from "./promo.ts";

export type WhopEnvironment = "sandbox" | "production";

export type WhopConfig = {
  apiKey: string;
  companyId: string;
  webhookSecret: string;
  environment: WhopEnvironment;
};

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function resolveWhopEnvironment(env: Record<string, string | undefined>): WhopEnvironment {
  const requested = env.WHOP_ENV?.trim().toLowerCase() ?? "";
  if (requested === "live" || requested === "production") return "production";
  return "sandbox";
}

export function whopApiOrigin(environment: WhopEnvironment) {
  return environment === "production" ? "https://api.whop.com" : "https://sandbox-api.whop.com";
}

/**
 * Company API key, company id, and webhook secret. Missing any of them means
 * card checkout cannot both charge and confirm, so the rail stays closed.
 * The key is read here and only from server callers.
 */
export function resolveWhop(env: Record<string, string | undefined>): WhopConfig | null {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  const webhookSecret = env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!apiKey || !companyId || !webhookSecret) return null;
  if (apiKey.length > 500 || companyId.length > 80 || webhookSecret.length > 500) return null;
  return {
    apiKey,
    companyId,
    webhookSecret,
    environment: resolveWhopEnvironment(env),
  };
}

/** Dollars for Whop inline pricing. 1999 cents becomes 19.99. */
export function whopDollars(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return Number((cents / 100).toFixed(2));
}

/**
 * Catalogue prices only. A `price` field on the incoming line is not part of
 * CartLineInput and is never read.
 */
export function priceCardOrder(items: CartLineInput[], promoCode: string | null | undefined) {
  const lines = resolveCartLines(items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promo = lookupPromo(promoCode);
  const quote = quoteFromSubtotal(subtotalCents, promo);
  if (quote.discountedCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return { lines, promoCode: promo?.code ?? null, ...quote, totalCents: quote.discountedCents };
}

export function buildCheckoutConfigurationBody(input: {
  companyId: string;
  orderId: string;
  totalCents: number;
  returnUrl: string;
  title: string;
}) {
  return {
    mode: "payment" as const,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      company_id: input.companyId,
      currency: "aud" as const,
      initial_price: whopDollars(input.totalCents),
      plan_type: "one_time" as const,
      release_method: "buy_now" as const,
      visibility: "hidden" as const,
      title: input.title,
      adaptive_pricing_enabled: false,
      force_create_new_plan: true,
      product: {
        external_identifier: "redline-labs-order",
        title: "Redline Labs order",
        visibility: "hidden" as const,
      },
      payment_method_configuration: {
        enabled: ["card"],
        disabled: [] as string[],
        include_platform_defaults: false,
      },
    },
  };
}

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
};

export async function postCheckoutConfiguration(
  config: Pick<WhopConfig, "apiKey" | "environment">,
  body: ReturnType<typeof buildCheckoutConfigurationBody>,
  fetchImpl: typeof fetch = fetch,
): Promise<WhopCheckoutSession> {
  const response = await fetchImpl(`${whopApiOrigin(config.environment)}/api/v1/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status})`);
  }
  const payload = (await response.json()) as { id?: unknown; plan?: { id?: unknown } };
  const sessionId = typeof payload.id === "string" ? payload.id : "";
  const planId = typeof payload.plan?.id === "string" ? payload.plan.id : "";
  if (!/^ch_[A-Za-z0-9]+$/.test(sessionId) || !/^plan_[A-Za-z0-9]+$/.test(planId)) {
    throw new Error("Whop checkout configuration did not return a session");
  }
  return { sessionId, planId };
}

export type WhopWebhookHeaders = {
  id: string;
  timestamp: string;
  signature: string;
};

export function readWhopWebhookHeaders(headers: {
  get(name: string): string | null;
}): WhopWebhookHeaders {
  return {
    id: headers.get("webhook-id")?.trim() ?? "",
    timestamp: headers.get("webhook-timestamp")?.trim() ?? "",
    signature: headers.get("webhook-signature")?.trim() ?? "",
  };
}

/**
 * Standard Webhooks, which is what Whop signs with. A `whsec_` secret is
 * base64-decoded. A raw dashboard secret is the HMAC key itself, matching
 * the SDK's `btoa(secret)` round trip.
 */
export function webhookKeyBytes(secret: string) {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    const decoded = Buffer.from(trimmed.slice("whsec_".length), "base64");
    if (decoded.length === 0) throw new Error("Invalid webhook secret");
    return decoded;
  }
  return Buffer.from(trimmed, "utf8");
}

export function verifyWhopWebhook(
  payload: string,
  headers: WhopWebhookHeaders,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): unknown {
  if (!headers.id || headers.id.length > 200) throw new Error("Invalid webhook id");
  if (!/^\d{1,20}$/.test(headers.timestamp)) throw new Error("Invalid webhook timestamp");
  const timestamp = Number(headers.timestamp);
  if (Math.abs(nowSeconds - timestamp) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp is outside the tolerance window");
  }
  if (!headers.signature || headers.signature.length > 2000) throw new Error("Invalid webhook signature");

  const expected = createHmac("sha256", webhookKeyBytes(secret))
    .update(`${headers.id}.${headers.timestamp}.${payload}`)
    .digest();
  const candidates = headers.signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter((part) => part.length > 0);

  const matches = candidates.some((candidate) => {
    const given = Buffer.from(candidate, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  if (!matches) throw new Error("Invalid webhook signature");

  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new Error("Invalid webhook payload");
  }
}

export type WhopPaymentEvent = {
  type: "payment.succeeded" | "payment.failed";
  paymentId: string;
  orderId: string;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readOrderId(metadata: unknown) {
  const record = readRecord(metadata);
  if (!record) return "";
  const orderId = record.orderId ?? record.order_id;
  return typeof orderId === "string" ? orderId.trim() : "";
}

/** Payment events Whop sends after the embedded checkout, including 3DS. */
export function parseWhopPaymentEvent(payload: unknown): WhopPaymentEvent | null {
  const event = readRecord(payload);
  if (!event) return null;
  const type = event.type;
  if (type !== "payment.succeeded" && type !== "payment.failed") return null;
  const data = readRecord(event.data);
  if (!data) return null;
  const paymentId = typeof data.id === "string" ? data.id.trim() : "";
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId) || paymentId.length > 80) return null;
  const orderId = readOrderId(data.metadata) || readOrderId(readRecord(data.checkout_configuration)?.metadata);
  if (!orderId) return null;
  return { type, paymentId, orderId };
}
