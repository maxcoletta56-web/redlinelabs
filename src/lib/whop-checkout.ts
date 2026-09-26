export type WhopMode = "sandbox" | "production";

export type WhopEnv = Record<string, string | undefined>;

export function whopMode(env: WhopEnv): WhopMode {
  return env.WHOP_ENV?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

export function whopApiOrigin(mode: WhopMode) {
  return mode === "production" ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1";
}

export function centsToAudAmount(cents: number) {
  return Number((Math.max(0, Math.round(cents)) / 100).toFixed(2));
}

export function whopConfigured(env: WhopEnv) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim());
}

export function buildCheckoutConfiguration(input: {
  companyId: string;
  orderId: string;
  amountCents: number;
  returnUrl: string;
  productId?: string | null;
}) {
  return {
    account_id: input.companyId,
    mode: "payment" as const,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      account_id: input.companyId,
      initial_price: centsToAudAmount(input.amountCents),
      currency: "aud",
      plan_type: "one_time" as const,
      title: `Redline Labs ${input.orderId}`,
      force_create_new_plan: true,
      visibility: "hidden" as const,
      ...(input.productId ? { product_id: input.productId } : {}),
      payment_method_configuration: {
        enabled: ["card"],
        include_platform_defaults: false,
      },
    },
  };
}

export async function createWhopCheckoutConfiguration(
  env: WhopEnv,
  input: {
    orderId: string;
    amountCents: number;
    returnUrl: string;
  },
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) {
    throw new Error("Whop is not configured");
  }
  const mode = whopMode(env);
  const body = buildCheckoutConfiguration({
    companyId,
    orderId: input.orderId,
    amountCents: input.amountCents,
    returnUrl: input.returnUrl,
    productId: env.WHOP_PRODUCT_ID?.trim() || null,
  });
  const response = await fetchImpl(`${whopApiOrigin(mode)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `checkout-${input.orderId}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Whop could not start checkout");
  }
  const payload = (await response.json()) as { id?: string };
  if (!payload.id || !payload.id.startsWith("ch_")) {
    throw new Error("Whop did not return a checkout session");
  }
  return { id: payload.id, mode, body };
}
