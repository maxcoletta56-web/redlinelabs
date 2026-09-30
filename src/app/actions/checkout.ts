"use server";

import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { checkoutBodySchema, type CheckoutPaymentMethod } from "@/lib/validation";
import { createWhopCardCheckout } from "@/lib/whop-checkout";
import type { WhopEnvironment } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Resolved rather than thrown. A thrown server action reaches the browser as
 * an opaque digest in production, which is what left checkout on a dead
 * spinner with nothing for the customer to act on.
 */
export type CheckoutStart =
  | { ok: true; method: "bank_transfer"; redirectUrl: string }
  | {
      ok: true;
      method: "card";
      reference: string;
      sessionId: string;
      planId: string;
      environment: WhopEnvironment;
      returnUrl: string;
    }
  | { ok: false; error: string };

export async function startCartCheckoutSession(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  paymentMethod?: CheckoutPaymentMethod | null;
}): Promise<CheckoutStart> {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
    shipping: input.shipping,
    paymentMethod: input.paymentMethod,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const provider = paymentsProvider();
  const method = parsed.data.paymentMethod ?? (provider === "bank_transfer" ? "bank_transfer" : "card");

  try {
    if (method === "card") {
      const checkout = await withTimeout(
        createWhopCardCheckout({
          items: parsed.data.items,
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          shipping: input.shipping,
          promoCode: parsed.data.promoCode,
          ageConfirmed: true,
          researchUse: true,
        }),
        PROVIDER_TIMEOUT_MS,
        "The card processor",
      );
      return {
        ok: true,
        method: "card",
        reference: checkout.reference,
        sessionId: checkout.sessionId,
        planId: checkout.planId,
        environment: checkout.environment,
        returnUrl: checkout.returnUrl,
      };
    }

    const order = await createBankTransferOrder({
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      shipping: input.shipping,
      promoCode: parsed.data.promoCode,
      ageConfirmed: true,
      researchUse: true,
    });
    return { ok: true, method: "bank_transfer", redirectUrl: order.redirectUrl };
  } catch (error) {
    console.error("[checkout] submit failed", {
      provider,
      slugs: parsed.data.items.map((item) => `${item.slug}${item.option ? `:${item.option}` : ""}`),
      quantities: parsed.data.items.map((item) => item.qty),
      promoCode: parsed.data.promoCode ?? null,
      emailDomain: parsed.data.email.split("@")[1] ?? "unknown",
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error:
        method === "bank_transfer"
          ? "We could not create your order. Nothing has been charged."
          : "The card processor did not respond. Nothing has been charged.",
    };
  }
}
