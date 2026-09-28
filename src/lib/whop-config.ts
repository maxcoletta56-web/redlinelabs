import type { WhopEmbeddedCheckout, WhopEnvironment } from "./whop-session.ts";

export type { WhopEmbeddedCheckout, WhopEnvironment };

export function whopEnvironment(
  env: Record<string, string | undefined> = process.env,
): WhopEnvironment {
  return env.WHOP_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

/** Card checkout can be offered once the company key and account id are set. */
export function whopCheckoutConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim());
}

export function whopCheckoutUrl(environment: WhopEnvironment) {
  const host = environment === "production" ? "https://api.whop.com" : "https://sandbox-api.whop.com";
  return `${host}/api/v1/checkout_configurations`;
}

/** Dollars for Whop's `initial_price`. The API does not take cents. */
export function centsToAud(cents: number) {
  const amount = Math.round(cents) / 100;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return Number(amount.toFixed(2));
}

export type WhopCheckoutPayload = {
  account_id: string;
  mode: "payment";
  currency: "aud";
  metadata: { orderId: string };
  redirect_url: string;
  plan: {
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    title: string;
    visibility: "hidden";
    force_create_new_plan: true;
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
 * Inline plan priced in AUD. `three_ds_level` is the regular frictionless
 * flow: Whop still requires a challenge when the processor asks, and charges
 * of $1,000 or more are challenged unless a stronger setting is chosen.
 * Card is the only method on this configuration. Bank transfer stays on our side.
 */
export function whopCheckoutPayload(input: {
  accountId: string;
  orderId: string;
  amountAud: number;
  title: string;
  returnUrl: string;
}): WhopCheckoutPayload {
  return {
    account_id: input.accountId,
    mode: "payment",
    currency: "aud",
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      currency: "aud",
      initial_price: input.amountAud,
      plan_type: "one_time",
      title: input.title,
      visibility: "hidden",
      force_create_new_plan: true,
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
