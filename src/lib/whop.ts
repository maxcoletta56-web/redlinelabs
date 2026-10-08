import "server-only";

import { withTimeout } from "./with-timeout.ts";

/** Sandbox until WHOP_SANDBOX is explicitly turned off. Live charges need `false`. */
export function whopSandbox(env: NodeJS.ProcessEnv = process.env) {
  const flag = env.WHOP_SANDBOX?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "live" || flag === "production") return false;
  return true;
}

export function whopEnvironment(env: NodeJS.ProcessEnv = process.env): "sandbox" | "production" {
  return whopSandbox(env) ? "sandbox" : "production";
}

export function whopApiBase(sandbox = whopSandbox()) {
  return sandbox ? "https://sandbox-api.whop.com/api/v1" : "https://api.whop.com/api/v1";
}

export function whopConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim());
}

/** Whop `initial_price` is major units (49.99), not cents. */
export function audMajorUnits(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export type WhopCheckoutConfigurationBody = {
  company_id: string;
  currency: "aud";
  mode: "payment";
  metadata: { orderId: string };
  plan: {
    company_id: string;
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    release_method: "buy_now";
    force_create_new_plan: true;
    adaptive_pricing_enabled: false;
    visibility: "hidden";
    title: string;
    product: {
      title: string;
      external_identifier: string;
      collect_shipping_address: false;
    };
  };
};

/**
 * Inline AUD price for one order. The amount is the server total. Metadata
 * `orderId` is copied onto the payment Whop sends to the webhook.
 */
export function whopCheckoutConfigurationBody(input: {
  companyId: string;
  orderId: string;
  totalCents: number;
}): WhopCheckoutConfigurationBody {
  const title = `Redline Labs order ${input.orderId}`.slice(0, 80);
  return {
    company_id: input.companyId,
    currency: "aud",
    mode: "payment",
    metadata: { orderId: input.orderId },
    plan: {
      company_id: input.companyId,
      currency: "aud",
      initial_price: audMajorUnits(input.totalCents),
      plan_type: "one_time",
      release_method: "buy_now",
      force_create_new_plan: true,
      adaptive_pricing_enabled: false,
      visibility: "hidden",
      title,
      product: {
        title,
        external_identifier: input.orderId,
        collect_shipping_address: false,
      },
    },
  };
}

const CHECKOUT_TIMEOUT_MS = 12_000;
const CONFIG_ID = /^ch_[A-Za-z0-9]+$/;

function redact(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/apik_[A-Za-z0-9_-]+/gi, "apik_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

/**
 * Creates a one-time checkout configuration. The API key stays on the server;
 * the returned `ch_` id is what the embedded Checkout Element mounts.
 */
export async function createWhopCheckoutConfiguration(
  input: { orderId: string; totalCents: number; idempotencyKey?: string },
  options?: { fetchImpl?: typeof fetch; env?: NodeJS.ProcessEnv },
): Promise<{ id: string; environment: "sandbox" | "production" }> {
  const env = options?.env ?? process.env;
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) {
    throw new Error("Card checkout is not configured");
  }
  if (input.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const sandbox = whopSandbox(env);
  const endpoint = `${whopApiBase(sandbox)}/checkout_configurations`;
  const body = whopCheckoutConfigurationBody({
    companyId,
    orderId: input.orderId,
    totalCents: input.totalCents,
  });
  const fetchImpl = options?.fetchImpl ?? fetch;

  let response: Response;
  try {
    response = await withTimeout(
      fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": input.idempotencyKey?.trim() || `whop-checkout-${input.orderId}`,
        },
        body: JSON.stringify(body),
      }),
      CHECKOUT_TIMEOUT_MS,
      "Whop",
    );
  } catch (error) {
    console.error("[whop] checkout configuration request failed", {
      orderId: input.orderId,
      sandbox,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: redact(error),
    });
    throw new Error("Whop did not respond. Nothing has been charged.");
  }

  const payload = (await response.json().catch(() => null)) as { id?: unknown; error?: { message?: unknown } } | null;
  const id = typeof payload?.id === "string" ? payload.id : "";
  if (!response.ok || !CONFIG_ID.test(id)) {
    const detail = typeof payload?.error?.message === "string" ? payload.error.message : "";
    console.error("[whop] checkout configuration was rejected", {
      orderId: input.orderId,
      sandbox,
      status: response.status,
      detail: detail.replace(/apik_[A-Za-z0-9_-]+/gi, "apik_[redacted]").slice(0, 200),
    });
    throw new Error("Whop could not start card checkout. Nothing has been charged.");
  }

  return { id, environment: sandbox ? "sandbox" : "production" };
}

/**
 * Origin for the embedded element's return URL. Localhost may be http; every
 * other host we accept is https. An arbitrary Origin header is not used, so a
 * crafted request cannot choose where Whop sends the buyer.
 */
export function whopReturnOrigin(
  headerList: { get(name: string): string | null },
  siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://redlinelabs.shop",
) {
  const host = (headerList.get("x-forwarded-host") || headerList.get("host") || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  if (host === "redlinelabs.shop" || host.endsWith(".vercel.app")) return `https://${host}`;
  return siteUrl.replace(/\/$/, "");
}

export function whopReturnUrl(origin: string, reference: string) {
  const url = new URL("/checkout/return", origin.endsWith("/") ? origin : `${origin}/`);
  url.searchParams.set("reference", reference);
  return url.toString();
}
