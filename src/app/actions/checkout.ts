"use server";

import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, type ShippingAddressInput } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { checkoutBodySchema } from "@/lib/validation";
import { createWhopCardCheckout } from "@/lib/whop-checkout";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Resolved rather than thrown. A thrown server action reaches the browser as
 * an opaque digest in production, which is what left checkout on a dead
 * spinner with nothing for the customer to act on.
 */
export type CheckoutStart =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string };

export type WhopCardStart =
  | {
      ok: true;
      sessionId: string;
      planId: string;
      orderReference: string;
      environment: "sandbox" | "production";
      returnUrl: string;
    }
  | { ok: false; error: string };

type CheckoutInput = {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  paymentMethod?: "card" | "bank_transfer";
};

export async function startWhopCardCheckout(input: CheckoutInput): Promise<WhopCardStart> {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
    shipping: input.shipping,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  try {
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
      sessionId: checkout.sessionId,
      planId: checkout.planId,
      orderReference: checkout.reference,
      environment: checkout.environment,
      returnUrl: checkout.returnUrl,
    };
  } catch (error) {
    console.error("[checkout] card submit failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "";
    const safe =
      /Nothing has been charged|shipping address|confirmation are required|Cart is empty|quantity|catalogue|greater than zero|not configured|unavailable/.test(
        message,
      );
    return {
      ok: false,
      error: safe ? message : "The card processor did not respond. Nothing has been charged.",
    };
  }
}

export async function startCartCheckoutSession(input: CheckoutInput): Promise<CheckoutStart> {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
    shipping: input.shipping,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const provider = input.paymentMethod === "bank_transfer" ? "bank_transfer" : paymentsProvider();

  try {
    if (input.paymentMethod === "card") {
      return {
        ok: false,
        error: "The card checkout could not be started. Nothing has been charged.",
      };
    }
    if (provider === "bank_transfer") {
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
      return { ok: true, redirectUrl: order.redirectUrl };
    }

    const redirectUrl = await withTimeout(
      createPayoneerCheckout({
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
    return { ok: true, redirectUrl };
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
        provider === "bank_transfer"
          ? "We could not create your order. Nothing has been charged."
          : "The card processor did not respond. Nothing has been charged.",
    };
  }
}
