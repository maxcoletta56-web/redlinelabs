"use server";

import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { createWhopCardCheckout } from "@/lib/whop-checkout";
import type { WhopEnvironment } from "@/lib/whop";
import { checkoutBodySchema } from "@/lib/validation";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

export type CheckoutMethod = "card" | "bank_transfer";

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
  method: CheckoutMethod;
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const method = input.method === "card" ? "card" : "bank_transfer";

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
      return { ok: true, method: "bank_transfer", redirectUrl: order.redirectUrl };
    }

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
      method: "card",
      reference: session.reference,
      sessionId: session.sessionId,
      planId: session.planId,
      environment: session.environment,
      returnUrl: session.returnUrl,
    };
  } catch (error) {
    console.error("[checkout] submit failed", {
      method,
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
          : "Card checkout did not start. Nothing has been charged.",
    };
  }
}
