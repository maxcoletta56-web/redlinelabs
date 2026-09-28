import "server-only";

import {
  centsToAud,
  whopCheckoutConfigured,
  whopCheckoutPayload,
  whopCheckoutUrl,
  whopEnvironment,
  type WhopEmbeddedCheckout,
  type WhopEnvironment,
} from "./whop-config.ts";

export type { WhopEmbeddedCheckout, WhopEnvironment };
export { whopCheckoutConfigured, whopEnvironment };

type CheckoutConfigurationResponse = {
  id?: string;
  plan?: { id?: string | null } | null;
};

/**
 * Creates the checkout configuration on Whop's API. Prices are computed
 * before this call. The API key stays in the Authorization header.
 */
export async function createWhopCheckoutConfiguration(
  input: {
    orderId: string;
    totalCents: number;
    title: string;
    returnUrl: string;
  },
  env: Record<string, string | undefined> = process.env,
  fetchImpl: typeof fetch = fetch,
) {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const accountId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !accountId) {
    throw new Error("Whop is not configured");
  }
  const environment = whopEnvironment(env);
  const body = whopCheckoutPayload({
    accountId,
    orderId: input.orderId,
    amountAud: centsToAud(input.totalCents),
    title: input.title,
    returnUrl: input.returnUrl,
  });
  const response = await fetchImpl(whopCheckoutUrl(environment), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": "2026-09-25",
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as CheckoutConfigurationResponse | null;
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status})`);
  }
  const sessionId = payload?.id ?? "";
  const planId = payload?.plan?.id ?? "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop did not return a checkout session");
  }
  return { sessionId, planId, environment };
}
