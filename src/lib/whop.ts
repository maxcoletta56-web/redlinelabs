import "server-only";

export type WhopEnvironment = "sandbox" | "production";

export type WhopCheckoutSession = {
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
};

const SESSION_ID = /^ch_[A-Za-z0-9]+$/;
const PLAN_ID = /^plan_[A-Za-z0-9]+$/;

export function whopEnvironment(env: NodeJS.ProcessEnv = process.env): WhopEnvironment {
  return env.WHOP_ENVIRONMENT?.trim().toLowerCase() === "production" ? "production" : "sandbox";
}

/** Sandbox is the default so card tests never hit the live Whop API by accident. */
export function whopApiOrigin(environment: WhopEnvironment) {
  return environment === "production"
    ? "https://api.whop.com/api/v1"
    : "https://sandbox-api.whop.com/api/v1";
}

export function whopConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.WHOP_API_KEY?.trim() && env.WHOP_WEBHOOK_SECRET?.trim() && env.WHOP_COMPANY_ID?.trim(),
  );
}

/** Whop plan prices are decimal dollars in the plan currency, not cents. */
export function audDollarsFromCents(cents: number) {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function whopCheckoutConfigurationBody(input: {
  companyId: string;
  orderId: string;
  totalCents: number;
  returnUrl: string;
}) {
  return {
    mode: "payment" as const,
    company_id: input.companyId,
    metadata: { orderId: input.orderId },
    redirect_url: input.returnUrl,
    plan: {
      company_id: input.companyId,
      currency: "aud" as const,
      initial_price: audDollarsFromCents(input.totalCents),
      plan_type: "one_time" as const,
      release_method: "buy_now" as const,
      visibility: "hidden" as const,
      force_create_new_plan: true,
      adaptive_pricing_enabled: false,
      title: `Order ${input.orderId}`,
      product: {
        external_identifier: "redline-labs-research-order",
        title: "Redline Labs research order",
        visibility: "hidden" as const,
      },
    },
  };
}

export function readWhopCheckoutConfiguration(value: unknown): { sessionId: string; planId: string } | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const sessionId = typeof row.id === "string" ? row.id : "";
  const plan = row.plan && typeof row.plan === "object" ? (row.plan as Record<string, unknown>) : null;
  const planId = typeof plan?.id === "string" ? plan.id : "";
  if (!SESSION_ID.test(sessionId) || !PLAN_ID.test(planId)) return null;
  return { sessionId, planId };
}

function redactSecrets(message: string) {
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/whsec_[A-Za-z0-9+/=_-]+/g, "whsec_[redacted]")
    .slice(0, 300);
}

export async function createWhopCheckoutConfiguration(
  input: {
    orderId: string;
    totalCents: number;
    returnUrl: string;
  },
  options?: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  },
): Promise<WhopCheckoutSession> {
  const env = options?.env ?? process.env;
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) {
    throw new Error("Whop is not configured");
  }
  const environment = whopEnvironment(env);
  const body = whopCheckoutConfigurationBody({
    companyId,
    orderId: input.orderId,
    totalCents: input.totalCents,
    returnUrl: input.returnUrl,
  });
  const fetchImpl = options?.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(`${whopApiOrigin(environment)}/checkout_configurations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Whop checkout configuration request failed: ${redactSecrets(message)}`);
  }
  if (!response.ok) {
    throw new Error(`Whop checkout configuration failed (${response.status})`);
  }
  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new Error("Whop checkout configuration response was not JSON");
  }
  const parsed = readWhopCheckoutConfiguration(json);
  if (!parsed) {
    throw new Error("Whop checkout configuration was missing a session");
  }
  return { ...parsed, environment };
}
