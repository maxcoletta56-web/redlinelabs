import "server-only";

import { priceCardCart } from "@/lib/card-pricing";
import { normalizeShipping, type BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { getSql, type Sql } from "@/lib/db";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { abandonPendingCardOrder, insertOrder, type OrderItemSnapshot } from "@/lib/orders";
import { lookupPromo } from "@/lib/promo";
import { SITE_URL } from "@/lib/seo";
import {
  readWhopCheckoutConfig,
  whopApiBase,
  whopCheckoutConfigurationBody,
  whopConfigured,
  whopEnvironment,
  type WhopEnv,
  type WhopEnvironment,
} from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

const DATABASE_TIMEOUT_MS = 12_000;
const WHOP_TIMEOUT_MS = 15_000;

export type WhopCardSession = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  amountCents: number;
  currency: "aud";
};

export type CreateWhopCardCheckoutOptions = {
  sql?: Sql | null;
  env?: WhopEnv;
  fetchImpl?: typeof fetch;
  origin?: string;
};

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function redact(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(?:apik|ws)_[A-Za-z0-9_-]+/gi, "[redacted]")
    .slice(0, 300);
}

function databaseFor(options?: CreateWhopCardCheckoutOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

export function cardReturnUrl(origin: string, reference: string) {
  const base = origin.replace(/\/$/, "");
  return `${base}/checkout/return/${encodeURIComponent(reference)}`;
}

export function checkoutOrigin(request: Request) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "")
    .split(",")[0]
    ?.trim();
  if (host && /^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    const proto = (request.headers.get("x-forwarded-proto") ?? "").split(",")[0]?.trim();
    return `${proto === "http" ? "http" : "https"}://${host}`;
  }
  return SITE_URL.replace(/\/$/, "");
}

export async function createWhopCardCheckout(
  input: {
    items: CartLineInput[];
    email: string;
    firstName?: string;
    lastName?: string;
    shipping?: BankTransferShippingInput | null;
    promoCode?: string | null;
    ageConfirmed: boolean;
    researchUse: boolean;
  },
  options?: CreateWhopCardCheckoutOptions,
): Promise<WhopCardSession> {
  const env = options?.env ?? process.env;
  if (!whopConfigured(env)) {
    throw new Error("Card checkout is not configured");
  }
  const sql = databaseFor(options);
  if (!sql) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) {
    throw new Error("A shipping address is required");
  }

  const lines = resolveCartLines(input.items);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const priced = priceCardCart(subtotalCents, lookupPromo(input.promoCode));
  if (priced.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));
  const environment = whopEnvironment(env);
  const reference = await withTimeout(
    insertOrder(
      {
        currency: "aud",
        subtotalCents: priced.subtotalCents,
        totalCents: priced.totalCents,
        promoCode: priced.promoCode,
        firstName: trimmed(input.firstName, 120) || "Customer",
        lastName: trimmed(input.lastName, 120) || "Account",
        email: trimmed(input.email, 200).toLowerCase(),
        items,
        shipping,
        status: "pending",
        paymentMethod: "card",
      },
      sql,
    ),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const returnUrl = cardReturnUrl(options?.origin ?? SITE_URL, reference);
  const body = whopCheckoutConfigurationBody({
    companyId: env.WHOP_COMPANY_ID?.trim() ?? "",
    reference,
    totalCents: priced.totalCents,
    returnUrl,
  });

  try {
    const response = await withTimeout(
      (options?.fetchImpl ?? fetch)(`${whopApiBase(environment)}/checkout_configurations`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.WHOP_API_KEY?.trim() ?? ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      WHOP_TIMEOUT_MS,
      "The card processor",
    );
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(`Whop checkout configuration failed (${response.status})`);
    }
    const config = readWhopCheckoutConfig(payload);
    if (!config) {
      throw new Error("Whop checkout configuration did not return a session");
    }
    return {
      reference,
      sessionId: config.sessionId,
      planId: config.planId,
      environment,
      returnUrl,
      amountCents: priced.totalCents,
      currency: "aud",
    };
  } catch (error) {
    await abandonPendingCardOrder(reference, sql).catch((abandonError: unknown) => {
      console.error("[whop] could not abandon pending order", {
        reference,
        errorMessage: redact(abandonError),
      });
    });
    console.error("[whop] checkout configuration failed", {
      reference,
      environment,
      errorMessage: redact(error),
    });
    throw new Error("The card processor did not start checkout. Nothing has been charged.");
  }
}
