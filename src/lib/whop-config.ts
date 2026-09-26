export type WhopEnvironment = "sandbox" | "production";

export type WhopEnv = Record<string, string | undefined>;

export function resolveWhopEnvironment(env: WhopEnv): WhopEnvironment {
  const raw = env.WHOP_ENV?.trim().toLowerCase();
  if (raw === "production" || raw === "live") return "production";
  return "sandbox";
}

export function whopApiOrigin(environment: WhopEnvironment) {
  return environment === "sandbox"
    ? "https://sandbox-api.whop.com/api/v1"
    : "https://api.whop.com/api/v1";
}

export type ResolvedWhop = {
  apiKey: string;
  companyId: string;
  environment: WhopEnvironment;
  apiOrigin: string;
  productId: string | null;
};

/** Server-only configuration. The API key is never returned to the browser. */
export function resolveWhop(env: WhopEnv): ResolvedWhop | undefined {
  const apiKey = env.WHOP_API_KEY?.trim() ?? "";
  const companyId = env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !companyId) return undefined;
  const environment = resolveWhopEnvironment(env);
  return {
    apiKey,
    companyId,
    environment,
    apiOrigin: whopApiOrigin(environment),
    productId: env.WHOP_PRODUCT_ID?.trim() || null,
  };
}

export function audDollars(cents: number) {
  if (!Number.isInteger(cents) || cents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  return Number((cents / 100).toFixed(2));
}

export function checkoutConfigurationBody(input: {
  companyId: string;
  orderId: string;
  totalCents: number;
  redirectUrl: string;
  productId?: string | null;
}) {
  const plan: Record<string, unknown> = {
    company_id: input.companyId,
    currency: "aud",
    initial_price: audDollars(input.totalCents),
    plan_type: "one_time",
    release_method: "buy_now",
    visibility: "hidden",
    force_create_new_plan: true,
    title: `Redline Labs ${input.orderId}`,
    three_ds_level: "frictionless_if_required",
    payment_method_configuration: {
      enabled: ["card"],
      disabled: [],
      include_platform_defaults: false,
    },
  };
  if (input.productId) plan.product_id = input.productId;
  return {
    company_id: input.companyId,
    mode: "payment",
    redirect_url: input.redirectUrl,
    metadata: {
      orderId: input.orderId,
    },
    plan,
  };
}

export function bankTransferDetails(env: WhopEnv) {
  return {
    accountName: env.BANK_TRANSFER_ACCOUNT_NAME?.trim() || null,
    bsb: env.BANK_TRANSFER_BSB?.trim() || null,
    accountNumber: env.BANK_TRANSFER_ACCOUNT_NUMBER?.trim() || null,
  };
}
