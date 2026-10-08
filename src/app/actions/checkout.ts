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
import {
  WhopOrderSavedError,
  openWhopCheckout,
  resumeWhopCheckout,
  whopCheckoutConfigured,
} from "@/lib/whop-checkout";
import type { WhopEmbedSession } from "@/lib/whop-embed";
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
  | { ok: true; redirectUrl: string; embed?: undefined }
  | { ok: true; embed: WhopEmbedSession; redirectUrl?: undefined }
  | { ok: false; error: string; reference?: string };

export async function startCartCheckoutSession(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  paymentMethod?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  orderReference?: string | null;
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

  const paypalOffered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );
  const whopOffered = whopCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    whopCheckoutConfigured(),
  );
  const method = resolveRequestedPaymentMethod({
    requested: parsed.data.paymentMethod,
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalOffered,
    whopOffered,
  });
  if (method === "unavailable") {
    return {
      ok: false,
      error:
        parsed.data.paymentMethod === "whop"
          ? "Card checkout is not available. Nothing has been charged."
          : "PayPal checkout is not available. Nothing has been charged.",
    };
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
        ageConfirmed: true,
        researchUse: true,
      });
      return { ok: true, redirectUrl: order.redirectUrl };
    }

    if (method === "whop") {
      const session = await withTimeout(
        input.orderReference
          ? resumeWhopCheckout(input.orderReference)
          : openWhopCheckout({
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
        "Card checkout",
      );
      return { ok: true, embed: session };
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
      return {
        ok: false,
        error: "Card checkout did not start. Nothing has been charged. You can try the card again.",
        reference: error.reference,
      };
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
            ? "Card checkout did not start. Nothing has been charged."
            : "PayPal did not respond. Nothing has been charged.",
    };
  }
}

/** Opens another embedded card session for an unpaid Whop order. */
export async function resumeWhopCardCheckout(
  reference: string,
): Promise<{ ok: true; embed: WhopEmbedSession } | { ok: false; error: string; paid?: boolean }> {
  const normalized = normalizeOrderReference(reference);
  if (!normalized) return { ok: false, error: "That order reference is not valid." };
  if (!whopCheckoutConfigured()) return { ok: false, error: "Card checkout is not available." };
  try {
    const embed = await withTimeout(resumeWhopCheckout(normalized), PROVIDER_TIMEOUT_MS, "Card checkout");
    return { ok: true, embed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("[checkout] Whop retry failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return {
      ok: false,
      error: message.includes("already paid")
        ? "This order is already paid."
        : "Card checkout did not start. Nothing has been charged.",
      paid: message.includes("already paid"),
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
