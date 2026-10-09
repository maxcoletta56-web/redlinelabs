import "server-only";

/**
 * Server-only Whop client. Prices are sent in AUD major units after this
 * process has priced the cart. `WHOP_API_KEY` is never read by a client component.
 *
 * Sandbox is the default (`https://sandbox-api.whop.com`) until `WHOP_SANDBOX=false`.
 * Card checkout is exercised with Whop's test card 4242 4242 4242 4242.
 */

const SANDBOX_API = "https://sandbox-api.whop.com/api/v1";
const LIVE_API = "https://api.whop.com/api/v1";

export type WhopEnvironmentName = "sandbox" | "production";

export type WhopEnv = {
  WHOP_API_KEY?: string;
  WHOP_WEBHOOK_SECRET?: string;
  WHOP_SANDBOX?: string;
  WHOP_COMPANY_ID?: string;
};

export function whopApiKey(env: WhopEnv = process.env) {
  return env.WHOP_API_KEY?.trim() ?? "";
}

export function whopConfigured(env: WhopEnv = process.env) {
  return whopApiKey(env).length > 0;
}

/** Unset or any value other than `false` stays on the sandbox API. */
export function whopUsesSandbox(env: WhopEnv = process.env) {
  return env.WHOP_SANDBOX?.trim().toLowerCase() !== "false";
}

export function whopEnvironmentName(env: WhopEnv = process.env): WhopEnvironmentName {
  return whopUsesSandbox(env) ? "sandbox" : "production";
}

export function whopApiBase(env: WhopEnv = process.env) {
  return whopUsesSandbox(env) ? SANDBOX_API : LIVE_API;
}

/** Two-decimal AUD amount. JSON keeps the shortest form (`10.1` for $10.10). */
export function centsToAud(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export type WhopCheckoutConfiguration = {
  id: string;
  planId: string | null;
};

export type CreateWhopConfigurationInput = {
  orderId: string;
  totalCents: number;
  returnUrl: string;
  env?: WhopEnv;
  fetchImpl?: typeof fetch;
};

/**
 * Inline one-time price in AUD. `three_ds_level` is the variant policy payment
 * mode uses: a challenge runs when the processor requires one, and payments of
 * $1,000 or more challenge unless a stricter level is set. The embedded element
 * drives that off-site step and returns the buyer to `returnUrl`.
 */
export async function createWhopCheckoutConfiguration(
  input: CreateWhopConfigurationInput,
): Promise<WhopCheckoutConfiguration> {
  const env = input.env ?? process.env;
  const apiKey = whopApiKey(env);
  if (!apiKey) throw new Error("Whop is not configured");
  if (input.totalCents <= 0) throw new Error("Order total must be greater than zero");
  const companyId = env.WHOP_COMPANY_ID?.trim() || null;
  const body: Record<string, unknown> = {
    mode: "payment",
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      currency: "aud",
      initial_price: centsToAud(input.totalCents),
      plan_type: "one_time",
      release_method: "buy_now",
      visibility: "hidden",
      force_create_new_plan: true,
      three_ds_level: "mandate_if_required",
      title: `Redline Labs ${input.orderId}`,
      ...(companyId ? { account_id: companyId } : {}),
    },
    ...(companyId ? { account_id: companyId } : {}),
  };
  const response = await (input.fetchImpl ?? fetch)(`${whopApiBase(env)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-10-08",
      "Idempotency-Key": `whop-checkout-${input.orderId}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  const payload = (await response.json().catch(() => null)) as { id?: unknown; plan?: { id?: unknown } } | null;
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status})`);
  }
  const id = typeof payload?.id === "string" ? payload.id.trim() : "";
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(id)) {
    throw new Error("Whop did not return a checkout session");
  }
  const planId = typeof payload?.plan?.id === "string" ? payload.plan.id.trim() : "";
  return {
    id,
    planId: /^plan_[A-Za-z0-9_-]{4,80}$/.test(planId) ? planId : null,
  };
}
