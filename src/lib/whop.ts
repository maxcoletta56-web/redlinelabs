import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Pinned to the checkout-configuration API this integration was written against. */
export const WHOP_API_VERSION = "2026-08-05-1";

export const WHOP_WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export type WhopEnvironment = "sandbox" | "live";

export type WhopEmbedEnvironment = "sandbox" | "production";

export type WhopConfig = {
  apiKey: string;
  webhookSecret: string;
  companyId: string;
  environment: WhopEnvironment;
  apiBase: string;
};

export type WhopCheckoutRequest = {
  account_id: string;
  mode: "payment";
  currency: "aud";
  redirect_url: string;
  metadata: { orderId: string };
  plan: {
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    release_method: "buy_now";
    visibility: "hidden";
    title: string;
  };
};

export class WhopWebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopWebhookError";
  }
}

function trimmed(value: string | undefined) {
  return value?.trim() ?? "";
}

/** Sandbox unless WHOP_ENV is exactly `live`, so a new deploy cannot charge real cards. */
export function whopEnvironment(value: string | undefined): WhopEnvironment {
  return value?.trim().toLowerCase() === "live" ? "live" : "sandbox";
}

export function whopApiBase(environment: WhopEnvironment) {
  return environment === "live" ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1";
}

export function whopEmbedEnvironment(environment: WhopEnvironment): WhopEmbedEnvironment {
  return environment === "live" ? "production" : "sandbox";
}

/**
 * Server-only. `WHOP_API_KEY` is never read from a NEXT_PUBLIC variable.
 * Returns null until both the API key and the biz_ company id are set.
 */
export function resolveWhop(env: Record<string, string | undefined>): WhopConfig | null {
  const apiKey = trimmed(env.WHOP_API_KEY);
  const companyId = trimmed(env.WHOP_COMPANY_ID);
  if (!apiKey || !companyId) return null;
  const environment = whopEnvironment(env.WHOP_ENV);
  return {
    apiKey,
    webhookSecret: trimmed(env.WHOP_WEBHOOK_SECRET),
    companyId,
    environment,
    apiBase: whopApiBase(environment),
  };
}

export function whopCardConfigured(env: Record<string, string | undefined> = process.env) {
  return resolveWhop(env) !== null;
}

/** Whole cents become the dollar amount Whop stores on an inline plan. */
export function centsToAudAmount(cents: number) {
  const amount = Math.round(cents);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return Number((amount / 100).toFixed(2));
}

/**
 * Inline plan priced in AUD. `orderId` is copied onto the payment, which is
 * how the webhook finds the row. The amount is the server total, never a
 * figure supplied by the browser.
 */
export function whopCheckoutRequest(input: {
  companyId: string;
  totalCents: number;
  orderId: string;
  redirectUrl: string;
}): WhopCheckoutRequest {
  return {
    account_id: input.companyId,
    mode: "payment",
    currency: "aud",
    redirect_url: input.redirectUrl,
    metadata: { orderId: input.orderId },
    plan: {
      currency: "aud",
      initial_price: centsToAudAmount(input.totalCents),
      plan_type: "one_time",
      release_method: "buy_now",
      visibility: "hidden",
      title: `Order ${input.orderId}`,
    },
  };
}

export type CreatedWhopCheckout = {
  sessionId: string;
  planId: string;
};

export function readCreatedWhopCheckout(payload: unknown): CreatedWhopCheckout {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : null;
  const sessionId = typeof row?.id === "string" ? row.id : "";
  const plan = row?.plan && typeof row.plan === "object" ? (row.plan as Record<string, unknown>) : null;
  const planId = typeof plan?.id === "string" ? plan.id : "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop did not return a checkout session");
  }
  return { sessionId, planId };
}

function webhookSecretBytes(secret: string) {
  const encoded = secret.startsWith("whsec_") ? secret.slice("whsec_".length) : secret;
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0) throw new WhopWebhookError("Invalid webhook signature");
  return bytes;
}

function signaturesMatch(expected: string, candidates: string[]) {
  const expectedBytes = Buffer.from(expected);
  return candidates.some((candidate) => {
    const actual = Buffer.from(candidate);
    return actual.length === expectedBytes.length && timingSafeEqual(actual, expectedBytes);
  });
}

/**
 * Standard Webhooks signature used by Whop. The signed content is
 * `{webhook-id}.{webhook-timestamp}.{raw body}`.
 */
export function verifyWhopWebhook(
  body: string,
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  if (!secret) throw new WhopWebhookError("Invalid webhook signature");
  const id = headers.id?.trim() ?? "";
  const timestamp = headers.timestamp?.trim() ?? "";
  const signature = headers.signature?.trim() ?? "";
  if (!id || !timestamp || !signature) throw new WhopWebhookError("Invalid webhook signature");

  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) throw new WhopWebhookError("Invalid webhook signature");
  if (Math.abs(nowSeconds - issuedAt) > WHOP_WEBHOOK_TOLERANCE_SECONDS) {
    throw new WhopWebhookError("Invalid webhook signature");
  }

  const expected = createHmac("sha256", webhookSecretBytes(secret))
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const candidates = signature
    .split(" ")
    .map((part) => (part.startsWith("v1,") ? part.slice(3) : ""))
    .filter((part) => part.length > 0);
  if (!signaturesMatch(expected, candidates)) throw new WhopWebhookError("Invalid webhook signature");
}

export type WhopWebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

export function parseWhopWebhookEvent(body: string): WhopWebhookEvent {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new WhopWebhookError("Invalid webhook payload");
  }
  const row = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const type = typeof row?.type === "string" ? row.type : "";
  const data = row?.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null;
  if (!type || !data) throw new WhopWebhookError("Invalid webhook payload");
  return { type, data };
}

export function whopOrderId(data: Record<string, unknown>) {
  const metadata =
    data.metadata && typeof data.metadata === "object" ? (data.metadata as Record<string, unknown>) : null;
  const raw = metadata?.orderId ?? metadata?.order_id;
  return typeof raw === "string" ? raw : "";
}

export function whopPaymentId(data: Record<string, unknown>) {
  const id = typeof data.id === "string" ? data.id.trim() : "";
  return /^[A-Za-z0-9_:-]{4,120}$/.test(id) ? id : "";
}

/**
 * A payment amount, when Whop includes one, has to match the stored order.
 * Missing amount fields are allowed because the price was set on the server
 * and the signature already proved the event came from Whop.
 */
export function whopAmountMatches(data: Record<string, unknown>, totalCents: number) {
  const currency = typeof data.currency === "string" ? data.currency.trim().toLowerCase() : "";
  if (currency && currency !== "aud") return false;
  const candidates = [data.total, data.final_amount, data.subtotal, data.amount];
  const numeric = candidates.find((value) => typeof value === "number" && Number.isFinite(value));
  if (typeof numeric !== "number") return true;
  if (Number.isInteger(numeric) && numeric === totalCents) return true;
  return Math.round(numeric * 100) === totalCents;
}

/** Where the embedded checkout sends the browser after 3D Secure or another redirect. */
export type CheckoutReturnOutcome = "success" | "error" | "unknown";

export function checkoutReturnOutcome(status: string | null | undefined): CheckoutReturnOutcome {
  const value = status?.trim().toLowerCase() ?? "";
  if (value === "success") return "success";
  if (value === "error") return "error";
  return "unknown";
}
