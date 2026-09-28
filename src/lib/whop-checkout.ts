import "server-only";

import type { BankTransferShippingInput } from "@/lib/bank-transfer-checkout";
import { lineLabel, type CartLineInput } from "@/lib/order";
import {
  abandonPendingOrder,
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import { quoteCart } from "@/lib/quote";
import { absoluteUrl } from "@/lib/seo";
import { withTimeout } from "@/lib/with-timeout";
import { whopEnvironmentName, type WhopEnvironmentName } from "@/lib/whop-environment";
import {
  checkoutConfigurationBody,
  createWhopCheckoutConfiguration,
} from "@/lib/whop";

const DATABASE_TIMEOUT_MS = 12_000;

export type WhopCardCheckout = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironmentName;
  returnUrl: string;
  totalCents: number;
};

export function whopCardConfigured(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.WHOP_API_KEY?.trim() && env.WHOP_COMPANY_ID?.trim() && ordersConfigured());
}

export function whopCardEnvironment(env: NodeJS.ProcessEnv = process.env): WhopEnvironmentName {
  return whopEnvironmentName(env.WHOP_ENVIRONMENT);
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

function normalizeShipping(
  shipping: BankTransferShippingInput | null | undefined,
): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  if (!line1) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city: trimmed(shipping?.city, 120),
    state: trimmed(shipping?.state, 60),
    postcode: trimmed(shipping?.postal_code, 20),
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

export async function createWhopCardCheckout(input: {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: BankTransferShippingInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<WhopCardCheckout> {
  const apiKey = process.env.WHOP_API_KEY?.trim() ?? "";
  const accountId = process.env.WHOP_COMPANY_ID?.trim() ?? "";
  if (!apiKey || !accountId) {
    throw new Error("Whop is not configured");
  }
  if (!ordersConfigured()) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const quote = quoteCart(input.items, input.promoCode);
  const items: OrderItemSnapshot[] = quote.lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));

  const reference = await withTimeout(
    insertOrder({
      currency: "aud",
      subtotalCents: quote.subtotalCents,
      totalCents: quote.totalCents,
      promoCode: quote.promo?.code ?? null,
      firstName: trimmed(input.firstName, 120) || "Customer",
      lastName: trimmed(input.lastName, 120) || "Account",
      email: trimmed(input.email, 200).toLowerCase(),
      items,
      shipping: normalizeShipping(input.shipping),
      status: "pending",
      paymentMethod: "card",
    }),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const environment = whopCardEnvironment();
  const returnUrl = absoluteUrl(`/checkout/complete?order=${reference}`);
  try {
    const session = await createWhopCheckoutConfiguration({
      apiKey,
      environment,
      idempotencyKey: reference,
      body: checkoutConfigurationBody({
        accountId,
        reference,
        totalCents: quote.totalCents,
        returnUrl,
      }),
    });
    return {
      reference,
      sessionId: session.sessionId,
      planId: session.planId,
      environment,
      returnUrl,
      totalCents: quote.totalCents,
    };
  } catch (error) {
    await abandonPendingOrder(reference).catch(() => undefined);
    throw error;
  }
}
