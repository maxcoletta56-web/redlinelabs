"use server";

import { headers } from "next/headers";
import { createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, type ShippingAddressInput } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { checkoutBodySchema } from "@/lib/validation";
import { openWhopCardCheckout, resumeWhopCardCheckout, WhopSessionError } from "@/lib/whop-checkout";
import type { WhopEnvironmentName } from "@/lib/whop-env";
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

export type WhopCheckoutStart =
  | {
      ok: true;
      reference: string;
      sessionId: string;
      planId: string;
      environment: WhopEnvironmentName;
      returnUrl: string;
    }
  | { ok: false; error: string; reference?: string };

async function siteOrigin() {
  const headerList = await headers();
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000";
  const proto =
    headerList.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

function cardError(error: unknown) {
  if (error instanceof WhopSessionError) return error.message;
  const message = error instanceof Error ? error.message : "";
  if (
    message.startsWith("Age and research") ||
    message.startsWith("This order") ||
    message.startsWith("Cart is empty") ||
    message.startsWith("Each line") ||
    message.startsWith("A cart item") ||
    message.startsWith("Choose a valid") ||
    message.startsWith("No price") ||
    message.startsWith("Order total") ||
    message.startsWith("Order was not found")
  ) {
    return message;
  }
  return "The card processor did not respond. Nothing has been charged.";
}

export async function startCartCheckoutSession(input: {
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
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  const provider = paymentsProvider();

  try {
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

export async function startWhopCardCheckout(input: {
  items: { slug: string; option?: string | null; qty: number }[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}): Promise<WhopCheckoutStart> {
  const parsed = checkoutBodySchema.safeParse({
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
    items: input.items,
    promoCode: input.promoCode,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" };
  }

  try {
    const session = await openWhopCardCheckout({
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      shipping: input.shipping,
      promoCode: parsed.data.promoCode,
      ageConfirmed: true,
      researchUse: true,
      origin: await siteOrigin(),
    });
    return { ok: true, ...session };
  } catch (error) {
    console.error("[checkout] whop session failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: cardError(error),
      reference: error instanceof WhopSessionError ? error.reference : undefined,
    };
  }
}

export async function resumeWhopCardSession(reference: string): Promise<WhopCheckoutStart> {
  try {
    const session = await resumeWhopCardCheckout(reference, await siteOrigin());
    return { ok: true, ...session };
  } catch (error) {
    console.error("[checkout] whop resume failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: cardError(error), reference };
  }
}
