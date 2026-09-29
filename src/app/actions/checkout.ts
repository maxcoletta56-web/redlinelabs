"use server";

import { headers } from "next/headers";
import { checkoutShippingSnapshot, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, type ShippingAddressInput } from "@/lib/checkout-session";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { getSql } from "@/lib/db";
import { insertOrder } from "@/lib/orders";
import { paymentsProvider } from "@/lib/payments-provider";
import { lookupPromo, orderTotalsFromCents } from "@/lib/promo";
import { checkoutBodySchema } from "@/lib/validation";
import {
  checkoutReturnUrl,
  createWhopCheckoutConfiguration,
  originFromHeaders,
  whopConfigured,
  whopEnvironment,
  type WhopEnvironment,
} from "@/lib/whop";
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
      sessionId: string;
      planId: string | null;
      environment: WhopEnvironment;
      reference: string;
      returnUrl: string;
    }
  | { ok: false; error: string };

export async function startBankTransferCheckout(input: {
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

  try {
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
  } catch (error) {
    console.error("[checkout] bank transfer failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, error: "We could not create your order. Nothing has been charged." };
  }
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

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * Prices the cart from the catalogue, stores a pending order, then opens a
 * Whop checkout configuration. The browser never supplies the amount.
 */
export async function startWhopCardCheckout(input: {
  items: CartLineInput[];
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
  if (!whopConfigured()) {
    return {
      ok: false,
      error: "Card checkout is unavailable right now. Choose bank transfer, or try again later.",
    };
  }

  const apiKey = process.env.WHOP_API_KEY?.trim() ?? "";
  const companyId = process.env.WHOP_COMPANY_ID?.trim() ?? "";
  const environment = whopEnvironment();

  try {
    const lines = resolveCartLines(parsed.data.items);
    const promo = lookupPromo(parsed.data.promoCode);
    const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
    const totals = orderTotalsFromCents(subtotalCents, promo);
    if (totals.discountedCents <= 0) {
      return { ok: false, error: "Order total must be greater than zero" };
    }

    const reference = await withTimeout(
      insertOrder(
        {
          currency: "aud",
          subtotalCents,
          totalCents: totals.discountedCents,
          promoCode: promo?.code ?? null,
          firstName: trimmed(parsed.data.firstName, 120) || "Customer",
          lastName: trimmed(parsed.data.lastName, 120) || "Account",
          email: trimmed(parsed.data.email, 200).toLowerCase(),
          items: lines.map((line) => ({
            slug: line.slug,
            name: lineLabel(line),
            option: line.option,
            variantLabel: line.variantLabel,
            sku: line.sku,
            qty: line.qty,
            unitAmountCents: line.unitAmountCents,
          })),
          shipping: checkoutShippingSnapshot(input.shipping),
        },
        getSql(),
        5,
        "pending",
      ),
      12_000,
      "The order database",
    );

    const headerList = await headers();
    const returnUrl = checkoutReturnUrl(
      originFromHeaders(headerList, process.env.NEXT_PUBLIC_SITE_URL || "http://127.0.0.1:3000"),
      reference,
    );
    const session = await withTimeout(
      createWhopCheckoutConfiguration({
        apiKey,
        companyId,
        environment,
        reference,
        totalCents: totals.discountedCents,
        returnUrl,
      }),
      PROVIDER_TIMEOUT_MS,
      "The card processor",
    );
    return {
      ok: true,
      sessionId: session.sessionId,
      planId: session.planId,
      environment,
      reference,
      returnUrl,
    };
  } catch (error) {
    console.error("[checkout] whop session failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      error: "The card processor did not respond. Nothing has been charged.",
    };
  }
}
