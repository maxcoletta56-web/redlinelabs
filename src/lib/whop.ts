import "server-only";

import { audMajorUnits, whopModeFromEnv, type WhopMode } from "@/lib/whop-mode";

export type { WhopMode };
export { audMajorUnits };

export type ResolvedWhop = {
  apiKey: string;
  companyId: string;
  webhookSecret: string;
  mode: WhopMode;
};

export type WhopEnv = Record<string, string | undefined>;

export function resolveWhop(env: WhopEnv): ResolvedWhop | undefined {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) return undefined;
  const mode = whopModeFromEnv(env.WHOP_ENV);
  return {
    apiKey,
    companyId,
    webhookSecret: env.WHOP_WEBHOOK_SECRET?.trim() ?? "",
    mode,
  };
}

export function whopConfigured(env: WhopEnv = process.env) {
  return Boolean(resolveWhop(env));
}

export function whopApiOrigin(mode: WhopMode) {
  return mode === "production" ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1";
}

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
};

export async function createWhopCheckoutConfiguration(
  config: ResolvedWhop,
  input: { orderId: string; amountCents: number; returnUrl: string },
): Promise<WhopCheckoutSession> {
  const response = await fetch(`${whopApiOrigin(config.mode)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-09-25",
      "Idempotency-Key": input.orderId,
    },
    body: JSON.stringify({
      account_id: config.companyId,
      mode: "payment",
      metadata: { orderId: input.orderId },
      redirect_url: input.returnUrl,
      plan: {
        account_id: config.companyId,
        plan_type: "one_time",
        currency: "aud",
        initial_price: audMajorUnits(input.amountCents),
        title: "Redline Labs order",
        description: input.orderId,
        force_create_new_plan: true,
        visibility: "hidden",
        three_ds_level: "frictionless_if_required",
        payment_method_configuration: {
          enabled: ["card"],
          include_platform_defaults: false,
        },
      },
    }),
  });
  if (!response.ok) {
    throw new Error("Whop could not start checkout");
  }
  const body = (await response.json()) as { id?: unknown; plan?: { id?: unknown } | null };
  const sessionId = typeof body.id === "string" ? body.id : "";
  const planId = typeof body.plan?.id === "string" ? body.plan.id : "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop did not return a checkout session");
  }
  return { sessionId, planId };
}
