import "server-only";

import { whopApiBase, whopEnvironment, type WhopEnvironmentName } from "@/lib/whop-env";
import { whopCheckoutBody } from "@/lib/whop-pricing";

const API_VERSION = "2026-09-25";

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
  environment: WhopEnvironmentName;
};

type FetchLike = typeof fetch;

function readId(value: unknown) {
  return typeof value === "string" && value ? value : "";
}

/**
 * Creates a checkout configuration with an inline AUD plan. `WHOP_API_KEY` is
 * read here and sent only as a bearer token to Whop. It is never returned.
 */
export async function createWhopCheckoutSession(
  input: {
    reference: string;
    totalCents: number;
    returnUrl: string;
    idempotencyKey: string;
  },
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: FetchLike = fetch,
): Promise<WhopCheckoutSession> {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) {
    throw new Error("Whop is not configured");
  }

  const environment = whopEnvironment(env);
  const response = await fetchImpl(`${whopApiBase(env)}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Api-Version-Date": API_VERSION,
      "Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify(
      whopCheckoutBody({
        companyId,
        reference: input.reference,
        totalCents: input.totalCents,
        returnUrl: input.returnUrl,
      }),
    ),
  });

  if (!response.ok) {
    throw new Error(`Whop checkout was not created (${response.status})`);
  }

  const json = (await response.json()) as { id?: unknown; plan?: { id?: unknown } | null };
  const sessionId = readId(json.id);
  const planId = readId(json.plan?.id);
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop checkout was not created");
  }
  return { sessionId, planId, environment };
}
