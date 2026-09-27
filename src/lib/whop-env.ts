export type WhopEnvironmentName = "sandbox" | "production";

/**
 * Sandbox unless `WHOP_ENV` is `live` or `production`. A missing value stays
 * on the sandbox API and the sandbox embed so a new deploy cannot charge live
 * cards before the sandbox test cards have been used.
 */
export function whopEnvironment(env: NodeJS.ProcessEnv = process.env): WhopEnvironmentName {
  const value = env.WHOP_ENV?.trim().toLowerCase() ?? "";
  if (value === "live" || value === "production") return "production";
  return "sandbox";
}

export function whopApiBase(env: NodeJS.ProcessEnv = process.env) {
  return whopEnvironment(env) === "sandbox"
    ? "https://sandbox-api.whop.com/api/v1"
    : "https://api.whop.com/api/v1";
}

/** Card checkout can be created once the company key and the orders database exist. */
export function whopCheckoutConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim() && env.DATABASE_URL?.trim());
}

export function whopWebhookConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.WHOP_WEBHOOK_SECRET?.trim());
}
