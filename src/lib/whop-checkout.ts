import "server-only";

import { normalizeCheckoutShipping, type BankTransferShippingInput } from "./bank-transfer-checkout.ts";
import { quoteCatalogueCart } from "./catalogue-quote.ts";
import { lineLabel, type CartLineInput } from "./order.ts";
import { insertOrder, markOrderFailed, ordersConfigured } from "./orders.ts";
import { absoluteUrl } from "./seo.ts";
import { createWhopCheckoutConfiguration, whopCheckoutConfigured } from "./whop.ts";
import type { WhopEmbeddedCheckout } from "./whop-config.ts";
import { withTimeout } from "./with-timeout.ts";

const DATABASE_TIMEOUT_MS = 12_000;
const WHOP_TIMEOUT_MS = 15_000;

export type WhopCardCheckout = WhopEmbeddedCheckout;

export function whopCardConfigured(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    whopCheckoutConfigured(env) &&
    Boolean(env.WHOP_WEBHOOK_SECRET?.trim()) &&
    ordersConfigured()
  );
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * Saves a pending order at the catalogue total, then opens a Whop checkout
 * configuration for that amount. The embedded element uses the returned
 * session. It does not redirect the buyer to Whop to start payment.
 */
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
  if (!whopCardConfigured()) {
    throw new Error("Whop is not configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const quoted = quoteCatalogueCart(input.items, input.promoCode);
  if (quoted.totalCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const reference = await withTimeout(
    insertOrder({
      status: "pending",
      currency: "aud",
      subtotalCents: quoted.subtotalCents,
      totalCents: quoted.totalCents,
      promoCode: quoted.promo?.code ?? null,
      firstName: trimmed(input.firstName, 120) || "Customer",
      lastName: trimmed(input.lastName, 120) || "Account",
      email: trimmed(input.email, 200).toLowerCase(),
      items: quoted.lines.map((line) => ({
        slug: line.slug,
        name: lineLabel(line),
        option: line.option,
        variantLabel: line.variantLabel,
        sku: line.sku,
        qty: line.qty,
        unitAmountCents: line.unitAmountCents,
      })),
      shipping: normalizeCheckoutShipping(input.shipping),
    }),
    DATABASE_TIMEOUT_MS,
    "The order database",
  );

  const returnUrl = absoluteUrl(`/checkout/return/${reference}`);
  try {
    const checkout = await withTimeout(
      createWhopCheckoutConfiguration({
        orderId: reference,
        totalCents: quoted.totalCents,
        title: `Redline Labs order ${reference}`,
        returnUrl,
      }),
      WHOP_TIMEOUT_MS,
      "Whop",
    );
    return {
      sessionId: checkout.sessionId,
      planId: checkout.planId,
      orderReference: reference,
      environment: checkout.environment,
      returnUrl,
      totalCents: quoted.totalCents,
    };
  } catch (error) {
    await markOrderFailed(reference).catch(() => undefined);
    throw error;
  }
}
