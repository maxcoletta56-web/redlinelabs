export const WHOP_SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
export const WHOP_PRODUCTION_API = "https://api.whop.com/api/v1";

export type WhopEnvironmentName = "sandbox" | "production";

export type WhopEmbedSession = {
  sessionId: string;
  planId: string;
  environment: WhopEnvironmentName;
  reference: string;
  totalCents: number;
  returnUrl: string;
};

/** Sandbox unless production is requested. Card testing uses the sandbox API and test cards. */
export function whopEnvironment(value: string | null | undefined): WhopEnvironmentName {
  return value?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function whopApiBase(environment: WhopEnvironmentName) {
  return environment === "production" ? WHOP_PRODUCTION_API : WHOP_SANDBOX_API;
}

export function whopCredentialsPresent(env: NodeJS.ProcessEnv) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim());
}

/** Major units for Whop `initial_price`. 1995 cents becomes 19.95. */
export function audDollarsFromCents(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function whopReturnUrl(origin: string, reference: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/checkout?order=${encodeURIComponent(reference)}`;
}

export type WhopCheckoutBody = {
  mode: "payment";
  account_id: string;
  metadata: { orderId: string };
  redirect_url: string;
  plan: {
    account_id: string;
    currency: "aud";
    initial_price: number;
    plan_type: "one_time";
    visibility: "hidden";
    force_create_new_plan: true;
    release_method: "buy_now";
    title: string;
    three_ds_level: "mandate_if_required";
  };
};

/**
 * Inline AUD plan. `three_ds_level` follows Whop's payment-mode policy:
 * challenge when the processor requires it (the sandbox 3DS card), otherwise
 * frictionless. The embed's return URL receives the buyer after that step.
 */
export function buildWhopCheckoutBody(input: {
  companyId: string;
  orderId: string;
  totalCents: number;
  returnUrl: string;
}): WhopCheckoutBody {
  return {
    mode: "payment",
    account_id: input.companyId,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      account_id: input.companyId,
      currency: "aud",
      initial_price: audDollarsFromCents(input.totalCents),
      plan_type: "one_time",
      visibility: "hidden",
      force_create_new_plan: true,
      release_method: "buy_now",
      title: `Redline Labs order ${input.orderId}`,
      three_ds_level: "mandate_if_required",
    },
  };
}

const WHOP_ID = /^[A-Za-z0-9_]+$/;

export function readWhopCheckoutIds(payload: unknown): { sessionId: string; planId: string } | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  const sessionId = row.id;
  const plan = row.plan;
  const planId =
    plan && typeof plan === "object" ? (plan as Record<string, unknown>).id : null;
  if (typeof sessionId !== "string" || typeof planId !== "string") return null;
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) return null;
  if (!WHOP_ID.test(sessionId) || !WHOP_ID.test(planId)) return null;
  if (sessionId.length > 80 || planId.length > 80) return null;
  return { sessionId, planId };
}
