import { createHmac, timingSafeEqual } from "node:crypto";
import { type WhopEnvironmentName } from "./whop-environment.ts";

/** Matches @whop/sdk WhopEnvironment. */
export const WHOP_API_BASE = {
  sandbox: "https://sandbox-api.whop.com/api/v1",
  production: "https://api.whop.com/api/v1",
} as const;

export type { WhopEnvironmentName };

/** Standard Webhooks rejects deliveries outside this window. */
const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;

export function audMajorUnits(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export type WhopCheckoutBody = {
  account_id: string;
  mode: "payment";
  metadata: { orderId: string };
  redirect_url: string;
  plan: {
    account_id: string;
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    release_method: "buy_now";
    visibility: "hidden";
    force_create_new_plan: true;
    title: string;
    three_ds_level: "frictionless_if_required";
    payment_method_configuration: {
      enabled: ["card"];
      include_platform_defaults: false;
    };
  };
};

/**
 * Inline AUD price for one order. The amount is the server total. Card is the
 * only method on the plan; payment-mode method overrides belong on the plan,
 * and 3DS uses Whop's frictionless-if-required flow (the embed completes the
 * challenge or redirect).
 */
export function checkoutConfigurationBody(input: {
  accountId: string;
  reference: string;
  totalCents: number;
  returnUrl: string;
}): WhopCheckoutBody {
  return {
    account_id: input.accountId,
    mode: "payment",
    metadata: { orderId: input.reference },
    redirect_url: input.returnUrl,
    plan: {
      account_id: input.accountId,
      currency: "aud",
      initial_price: audMajorUnits(input.totalCents),
      plan_type: "one_time",
      release_method: "buy_now",
      visibility: "hidden",
      force_create_new_plan: true,
      title: `Redline Labs order ${input.reference}`,
      three_ds_level: "frictionless_if_required",
      payment_method_configuration: {
        enabled: ["card"],
        include_platform_defaults: false,
      },
    },
  };
}

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
};

export async function createWhopCheckoutConfiguration(input: {
  apiKey: string;
  environment: WhopEnvironmentName;
  body: WhopCheckoutBody;
  idempotencyKey: string;
  fetchImpl?: typeof fetch;
}): Promise<WhopCheckoutSession> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("Whop is not configured");
  const response = await (input.fetchImpl ?? fetch)(`${WHOP_API_BASE[input.environment]}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-09-25",
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(input.body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error("Whop could not start checkout");
  }
  return readCheckoutSession(await response.json());
}

export function readCheckoutSession(body: unknown): WhopCheckoutSession {
  const row = body && typeof body === "object" ? (body as { id?: unknown; plan?: { id?: unknown } }) : null;
  const sessionId = row?.id;
  const planId = row?.plan?.id;
  if (typeof sessionId !== "string" || !sessionId.startsWith("ch_")) {
    throw new Error("Whop did not return a checkout session");
  }
  if (typeof planId !== "string" || !planId.startsWith("plan_")) {
    throw new Error("Whop did not return a plan for the checkout session");
  }
  return { sessionId, planId };
}

function headerValue(headers: Headers | Record<string, string>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? "";
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value;
  }
  return "";
}

function signaturesMatch(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Verifies a Whop webhook the way the API signs it: HMAC-SHA256 over
 * `{webhook-id}.{webhook-timestamp}.{raw body}` using the signing secret's
 * exact bytes, then base64. The secret is not base64-decoded and no prefix
 * is stripped. The body must be the raw request text.
 */
export function unwrapWhopWebhook(payload: string, headers: Headers | Record<string, string>, secret: string) {
  if (!secret.trim()) {
    throw new Error("Cannot verify a webhook without a key");
  }
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new Error("Missing webhook signature");
  }
  const issuedAt = Number(timestamp);
  if (!Number.isFinite(issuedAt)) {
    throw new Error("Invalid webhook timestamp");
  }
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - issuedAt) > WEBHOOK_TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp is outside the tolerance window");
  }
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const matched = signature.split(" ").some((part) => {
    if (!part.startsWith("v1,")) return false;
    return signaturesMatch(part.slice(3), expected);
  });
  if (!matched) {
    throw new Error("Invalid webhook signature");
  }
  return JSON.parse(payload) as unknown;
}

export type WhopPaymentNotice = {
  type: "succeeded" | "failed" | "requires_action";
  paymentId: string;
  orderId: string;
};

function readMetadataOrderId(metadata: unknown) {
  if (!metadata || typeof metadata !== "object") return "";
  const row = metadata as Record<string, unknown>;
  const orderId = row.orderId ?? row.order_id;
  return typeof orderId === "string" ? orderId : "";
}

/** payment.succeeded, payment.failed, and payment.requires_action. Other events are ignored. */
export function readWhopPaymentNotice(event: unknown): WhopPaymentNotice | null {
  if (!event || typeof event !== "object") return null;
  const row = event as { type?: unknown; data?: unknown };
  const type = typeof row.type === "string" ? row.type : "";
  const normalized =
    type === "payment.succeeded" || type === "payment_succeeded"
      ? "succeeded"
      : type === "payment.failed" || type === "payment_failed"
        ? "failed"
        : type === "payment.requires_action" || type === "payment_requires_action"
          ? "requires_action"
          : null;
  if (!normalized) return null;
  const data = row.data && typeof row.data === "object" ? (row.data as Record<string, unknown>) : null;
  const paymentId = typeof data?.id === "string" ? data.id : "";
  const orderId = readMetadataOrderId(data?.metadata);
  if (!paymentId || !orderId) return null;
  return { type: normalized, paymentId, orderId };
}
