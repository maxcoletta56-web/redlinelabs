import {
  checkoutConfigurationBody,
  resolveWhop,
  type WhopEnvironment,
  type WhopEnv,
} from "./whop-config.ts";

export type CardCheckoutSession = {
  planId: string;
  sessionId: string;
  environment: WhopEnvironment;
};

function redact(value: string) {
  return value.replace(/sk_[A-Za-z0-9]+/g, "[redacted]").replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
}

function whopErrorMessage(status: number, body: string) {
  let detail = "";
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string }; message?: string };
    detail = parsed.error?.message || parsed.message || "";
  } catch {
    detail = "";
  }
  const clean = redact(detail).slice(0, 240);
  if (clean) return `Whop could not start checkout (${status}): ${clean}`;
  return `Whop could not start checkout (${status})`;
}

export function whopConfigured(env: WhopEnv = process.env) {
  return Boolean(resolveWhop(env));
}

export async function createCardCheckoutSession(
  env: WhopEnv,
  input: { orderId: string; totalCents: number; returnUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<CardCheckoutSession> {
  const config = resolveWhop(env);
  if (!config) throw new Error("Card checkout is not configured");
  const payload = checkoutConfigurationBody({
    companyId: config.companyId,
    orderId: input.orderId,
    totalCents: input.totalCents,
    redirectUrl: input.returnUrl,
    productId: config.productId,
  });
  const response = await fetchImpl(`${config.apiOrigin}/checkout_configurations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `order-${input.orderId}`,
    },
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(whopErrorMessage(response.status, body));

  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error("Whop did not return a checkout session");
  }
  const row = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  const plan = row?.plan && typeof row.plan === "object" ? (row.plan as Record<string, unknown>) : null;
  const sessionId = typeof row?.id === "string" ? row.id : "";
  const planId = typeof plan?.id === "string" ? plan.id : "";
  if (!sessionId.startsWith("ch_") || !planId.startsWith("plan_")) {
    throw new Error("Whop did not return a checkout session");
  }
  return { planId, sessionId, environment: config.environment };
}
