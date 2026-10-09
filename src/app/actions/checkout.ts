"use server";

import { redirect } from "next/navigation";
import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import {
  createPaypalCheckout,
  paypalConfigured,
  resumePaypalCheckoutSession,
  type ShippingAddressInput,
} from "@/lib/checkout-session";
import { normalizeOrderReference } from "@/lib/order-reference";
import {
  paypalCheckoutOffered,
  resolveRequestedPaymentMethod,
  whopCheckoutOffered,
} from "@/lib/payments-provider";
import { PaypalOrderSavedError } from "@/lib/paypal-checkout";
import { whopConfigured } from "@/lib/whop";
import { WhopOrderSavedError, createWhopCardCheckout, resumeWhopCardCheckout } from "@/lib/whop-checkout";
import { checkoutBodySchema } from "@/lib/validation";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Resolved rather than thrown. A thrown server action reaches the browser as
 * an opaque digest in production, which is what left checkout on a dead
 * spinner with nothing for the customer to act on.
 */
export type CheckoutStart =
  | { ok: true; redirectUrl: string; whop?: undefined }
  | {
      ok: true;
      redirectUrl?: undefined;
      whop: {
        sessionId: string;
        planId: string | null;
        returnUrl: string;
        environment: "sandbox" | "production";
        reference: string;
      };
    }
  | { ok: false; error: string };

export async function startCartCheckoutSession(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  club?: { email: string; code: string; points: number } | null;
  paymentMethod?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
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
    club: input.club,
    paymentMethod: input.paymentMethod,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const paypalOffered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );
  const whopOffered = whopCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    whopConfigured(),
  );
  const method = resolveRequestedPaymentMethod({
    requested: parsed.data.paymentMethod,
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalOffered,
    whopOffered,
  });
  if (method === "unavailable") {
    return { ok: false, error: "That payment method is not available. Nothing has been charged." };
  }

  try {
    if (method === "bank_transfer") {
      const order = await createBankTransferOrder({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        shipping: input.shipping,
        promoCode: parsed.data.promoCode,
        club: parsed.data.club,
        ageConfirmed: true,
        researchUse: true,
      });
      return { ok: true, redirectUrl: order.redirectUrl };
    }

    if (method === "whop") {
      const session = await withTimeout(
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
        "Whop",
      );
      return {
        ok: true,
        whop: {
          sessionId: session.sessionId,
          planId: session.planId,
          returnUrl: session.returnUrl,
          environment: session.environment,
          reference: session.reference,
        },
      };
    }

    const redirectUrl = await withTimeout(
      createPaypalCheckout({
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
      "PayPal",
    );
    return { ok: true, redirectUrl };
  } catch (error) {
    if (error instanceof PaypalOrderSavedError) {
      return { ok: true, redirectUrl: `/order/${error.reference}?paypal=unavailable` };
    }
    if (error instanceof WhopOrderSavedError) {
      return { ok: true, redirectUrl: `/order/${error.reference}?whop=unavailable` };
    }
    console.error("[checkout] submit failed", {
      provider: method,
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
          : method === "whop"
            ? "Card checkout did not open. Nothing has been charged."
            : "PayPal did not respond. Nothing has been charged.",
    };
  }
}

/** Buyer retry from the order page or an unfinished PayPal return. */
export async function retryPaypalOrder(formData: FormData) {
  const reference = normalizeOrderReference(
    typeof formData.get("reference") === "string" ? String(formData.get("reference")) : "",
  );
  if (!reference) redirect("/checkout");
  const offered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );
  if (!offered) redirect(`/order/${reference}?paypal=unavailable`);
  const destination = await resumePaypalCheckoutSession(reference).catch((error: unknown) => {
    console.error("[checkout] PayPal retry failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return `/order/${reference}?paypal=unavailable`;
  });
  redirect(destination);
}

/** A new embedded session for a card order that is still unpaid. */
export async function resumeWhopOrder(reference: string): Promise<
  | {
      ok: true;
      whop: {
        sessionId: string;
        planId: string | null;
        returnUrl: string;
        environment: "sandbox" | "production";
      };
    }
  | { ok: false; error: string }
> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return { ok: false, error: "That order could not be found." };
  try {
    const session = await resumeWhopCardCheckout(normalized);
    return {
      ok: true,
      whop: {
        sessionId: session.sessionId,
        planId: session.planId,
        returnUrl: session.returnUrl,
        environment: session.environment,
      },
    };
  } catch (error) {
    console.error("[checkout] Whop retry failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, error: "Card checkout could not be opened. Nothing has been charged." };
  }
}
