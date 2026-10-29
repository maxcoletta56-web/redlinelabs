import { createHmac, timingSafeEqual } from "node:crypto";

import type { WhopMode } from "./whop-session.ts";

const SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
const PRODUCTION_API = "https://api.whop.com/api/v1";

/** Matches the @whop/sdk pin used for this integration. */
export const WHOP_API_VERSION_DATE = "2026-10-29";

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type ResolvedWhop = {
  apiKey: string;
  accountId: string | null;
  webhookSecret: string;
  mode: WhopMode;
  baseUrl: string;
};

export function whopMode(value: string | null | undefined): WhopMode {
  return value?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

/** Absent API key means card checkout is off. Sandbox is the default until WHOP_ENV=production. */
export function resolveWhop(env: NodeJS.ProcessEnv): ResolvedWhop | null {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  if (!apiKey) return null;
  const mode = whopMode(env.WHOP_ENV);
  const accountId = env.WHOP_ACCOUNT_ID?.trim() || null;
  return {
    apiKey,
    accountId,
    webhookSecret: env.WHOP_WEBHOOK_SECRET?.trim() ?? "",
    mode,
    baseUrl: mode === "production" ? PRODUCTION_API : SANDBOX_API,
  };
}

/** Major units for Whop inline pricing. 1995 cents is 19.95. */
export function audMajorUnits(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function whopCheckoutConfigurationBody(input: {
  reference: string;
  totalCents: number;
  redirectUrl: string;
  accountId?: string | null;
}) {
  const price = audMajorUnits(input.totalCents);
  const account = input.accountId?.trim() || null;
  return {
    mode: "payment" as const,
    currency: "aud",
    metadata: { orderId: input.reference },
    redirect_url: input.redirectUrl,
    ...(account ? { account_id: account } : {}),
    variant: {
      ...(account ? { account_id: account } : {}),
      billing_type: "one_time" as const,
      currency: "aud",
      initial_price: price,
      title: `Redline Labs ${input.reference}`,
      visibility: "hidden" as const,
      force_create_new_plan: true,
      release_method: "buy_now" as const,
      three_ds_level: "mandate_if_required" as const,
      metadata: { orderId: input.reference },
    },
  };
}

export type WhopCheckoutConfiguration = {
  id: string;
  planId: string;
};

export function readWhopCheckoutConfiguration(value: unknown): WhopCheckoutConfiguration | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const id = readPrefixedId(row.id, "ch_");
  const variant = row.variant;
  const planId =
    variant && typeof variant === "object"
      ? readPrefixedId((variant as Record<string, unknown>).id, "plan_")
      : null;
  if (!id || !planId) return null;
  return { id, planId };
}

function readPrefixedId(value: unknown, prefix: string) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith(prefix) || trimmed.length > 80) return null;
  return trimmed;
}

export class WhopSignatureError extends Error {
  constructor(message = "Invalid Whop webhook signature") {
    super(message);
    this.name = "WhopSignatureError";
  }
}

function headerValue(headers: Headers, name: string) {
  return headers.get(name)?.trim() ?? "";
}

function signaturesMatch(expected: string, presented: string) {
  const expectedBytes = Buffer.from(expected);
  const presentedBytes = Buffer.from(presented);
  if (expectedBytes.length !== presentedBytes.length) return false;
  return timingSafeEqual(expectedBytes, presentedBytes);
}

/**
 * Standard Webhooks signature, with the HMAC key set to the raw Whop secret
 * (the `ws_` value, unmodified). `webhook-signature` may list several `v1` values.
 */
export function verifyWhopSignature(
  payload: string,
  headers: Headers,
  secret: string,
  nowMs = Date.now(),
) {
  const key = secret.trim();
  if (!key) throw new WhopSignatureError("Missing webhook secret");
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) throw new WhopSignatureError("Missing signature headers");
  if (!/^\d+$/.test(timestamp)) throw new WhopSignatureError("Invalid signature timestamp");
  const sentAt = Number(timestamp);
  const now = Math.floor(nowMs / 1000);
  if (Math.abs(now - sentAt) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new WhopSignatureError("Signature timestamp is outside the tolerance window");
  }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const presented = signature.split(" ").filter((part) => part.startsWith("v1,"));
  if (!presented.some((part) => signaturesMatch(expected, part.slice(3)))) {
    throw new WhopSignatureError();
  }
  return JSON.parse(payload) as unknown;
}
