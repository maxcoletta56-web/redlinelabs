export type PayoneerMode = "live" | "sandbox";

export type PayoneerEnv = Record<string, string | undefined>;

export type ResolvedPayoneer = {
  merchantCode: string;
  paymentToken: string;
  mode: PayoneerMode;
};

export type PayoneerList = {
  listUrl: string;
  longId: string | null;
  transactionId: string | null;
  statusCode: string | null;
  amount: number | null;
  currency: string | null;
};

const LIST_CONTENT_TYPE = "application/vnd.optile.payment.enterprise-v1-extensible+json";

export function shouldRequireLivePayoneer(env: PayoneerEnv) {
  const required = env.PAYONEER_REQUIRE_LIVE?.toLowerCase();
  if (required === "1" || required === "true") return true;
  return env.VERCEL_ENV === "production";
}

export function resolvePayoneer(env: PayoneerEnv): ResolvedPayoneer | undefined {
  const merchantCode = env.PAYONEER_MERCHANT_CODE?.trim() ?? "";
  const paymentToken = env.PAYONEER_PAYMENT_TOKEN?.trim() ?? "";
  if (!merchantCode || !paymentToken) return undefined;

  const requested = env.PAYONEER_ENV?.trim().toLowerCase();
  const mode: PayoneerMode =
    requested === "sandbox" || requested === "live"
      ? requested
      : shouldRequireLivePayoneer(env)
        ? "live"
        : "sandbox";

  if (shouldRequireLivePayoneer(env) && mode !== "live") return undefined;
  return { merchantCode, paymentToken, mode };
}

export function payoneerApiOrigin(mode: PayoneerMode) {
  return mode === "live" ? "https://api.live.oscato.com" : "https://api.sandbox.oscato.com";
}

export function audAmount(cents: number) {
  const amount = Math.round(cents);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Checkout amount must be greater than zero");
  }
  return Number((amount / 100).toFixed(2));
}

export function isPayoneerListUrl(value: string, mode: PayoneerMode) {
  try {
    const url = new URL(value);
    return url.origin === payoneerApiOrigin(mode) && url.pathname.startsWith("/pci/v1/");
  } catch {
    return false;
  }
}

export function hostedPaymentPageUrl(mode: PayoneerMode, listUrl: string) {
  if (!isPayoneerListUrl(listUrl, mode)) {
    throw new Error("Payoneer did not return a payment list");
  }
  const page = new URL(
    `https://resources.${mode}.oscato.com/paymentpage/v3/responsive.html`,
  );
  page.searchParams.set("listUrl", listUrl);
  return page.toString();
}

export function payoneerListIsPaid(statusCode: string | null | undefined) {
  const code = statusCode?.trim().toLowerCase();
  return code === "charged" || code === "paid";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function parsePayoneerList(value: unknown, mode: PayoneerMode): PayoneerList {
  const row = asRecord(value);
  const links = asRecord(row?.links);
  const identification = asRecord(row?.identification);
  const status = asRecord(row?.status);
  const payment = asRecord(row?.payment);
  const listUrl = typeof links?.self === "string" ? links.self : "";
  if (!isPayoneerListUrl(listUrl, mode)) {
    throw new Error("Payoneer did not return a payment list");
  }
  return {
    listUrl,
    longId: typeof identification?.longId === "string" ? identification.longId : null,
    transactionId:
      typeof identification?.transactionId === "string" ? identification.transactionId : null,
    statusCode: typeof status?.code === "string" ? status.code : null,
    amount: typeof payment?.amount === "number" ? payment.amount : null,
    currency: typeof payment?.currency === "string" ? payment.currency : null,
  };
}

export async function createPayoneerList(
  config: ResolvedPayoneer,
  body: Record<string, unknown>,
) {
  const response = await fetch(`${payoneerApiOrigin(config.mode)}/api/lists`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.merchantCode}:${config.paymentToken}`).toString("base64")}`,
      "Content-Type": LIST_CONTENT_TYPE,
      Accept: LIST_CONTENT_TYPE,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error("Payoneer could not start checkout");
  }
  return parsePayoneerList(await response.json(), config.mode);
}

export async function readPayoneerList(config: ResolvedPayoneer, listUrl: string) {
  if (!isPayoneerListUrl(listUrl, config.mode)) {
    throw new Error("Payoneer payment list is not available");
  }
  const response = await fetch(listUrl, {
    method: "GET",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.merchantCode}:${config.paymentToken}`).toString("base64")}`,
      Accept: LIST_CONTENT_TYPE,
    },
    redirect: "error",
  });
  if (!response.ok) {
    throw new Error("Payoneer could not confirm this payment");
  }
  return parsePayoneerList(await response.json(), config.mode);
}
