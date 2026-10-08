"use server";

import { headers } from "next/headers";
import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPaypalCheckout, type ShippingAddressInput } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { checkoutBodySchema } from "@/lib/validation";
import { createWhopCardCheckout, resumeWhopCardCheckout } from "@/lib/whop-checkout";
import { whopReturnOrigin } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

/**
 * Resolved rather than thrown. A thrown server action reaches the browser as
 * an opaque digest in production, which is what left checkout on a dead
 * spinner with nothing for the customer to act on.
 */
export type CheckoutStart =
  | { ok: true; method: "bank_transfer" | "paypal"; redirectUrl: string }
  | {
      ok: true;
      method: "whop";
      sessionId: string;
      environment: "sandbox" | "production";
      returnUrl: string;
      reference: string;
      amountCents: number;
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
  ageConfirmed: boolean;
  researchUse: boolean;
  method?: "bank_transfer" | "whop" | "card";
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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const method =
    input.method === "card" || input.method === "whop"
      ? "whop"
      : input.method === "bank_transfer"
        ? "bank_transfer"
        : paymentsProvider() === "paypal"
          ? "paypal"
          : "bank_transfer";

  try {
    if (method === "whop") {
      const headerList = await headers();
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
          returnOrigin: whopReturnOrigin(headerList),
        }),
        PROVIDER_TIMEOUT_MS,
        "Whop",
      );
      return {
        ok: true,
        method: "whop",
        sessionId: session.sessionId,
        environment: session.environment,
        returnUrl: session.returnUrl,
        reference: session.reference,
        amountCents: session.amountCents,
      };
    }

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
      return { ok: true, method: "bank_transfer", redirectUrl: order.redirectUrl };
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
    return { ok: true, method: "paypal", redirectUrl };
  } catch (error) {
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
        method === "whop"
          ? "We could not start card checkout. Nothing has been charged."
          : method === "bank_transfer"
            ? "We could not create your order. Nothing has been charged."
            : "PayPal did not respond. Nothing has been charged.",
    };
  }
}

/** Mounts a fresh embedded checkout for an order that is still unpaid. */
export async function resumeCardCheckout(reference: string): Promise<CheckoutStart> {
  try {
    const headerList = await headers();
    const session = await withTimeout(
      resumeWhopCardCheckout(reference, whopReturnOrigin(headerList)),
      PROVIDER_TIMEOUT_MS,
      "Whop",
    );
    return {
      ok: true,
      method: "whop",
      sessionId: session.sessionId,
      environment: session.environment,
      returnUrl: session.returnUrl,
      reference: session.reference,
      amountCents: session.amountCents,
    };
  } catch (error) {
    console.error("[checkout] card resume failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, error: "Card checkout could not be restarted. Nothing has been charged." };
  }
}
