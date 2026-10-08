import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPaypalCheckout, paypalConfigured } from "@/lib/checkout-session";
import {
  checkoutSurface,
  paymentsProvider,
  paypalCheckoutOffered,
  resolveRequestedPaymentMethod,
} from "@/lib/payments-provider";
import { PaypalOrderSavedError } from "@/lib/paypal-checkout";
import { resolvePaypal } from "@/lib/paypal";
import { checkoutBodySchema } from "@/lib/validation";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYPAL_SETUP =
  "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. Production uses the live PayPal API.";

export async function GET() {
  const provider = paymentsProvider();
  const paypalReady = paypalConfigured();
  const bankReady = bankTransferConfigured();
  const surface = checkoutSurface({
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
  });
  return NextResponse.json({
    provider,
    configured: surface.setup === null,
    showChoice: surface.showChoice,
    defaultMethod: surface.defaultMethod,
    setup: surface.setup,
    paypalOffered: surface.showChoice,
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
    mode: paypalReady ? (resolvePaypal(process.env)?.mode ?? null) : null,
  });
}

export async function POST(request: Request) {
  const paypalOffered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" },
      { status: 400 },
    );
  }

  const method = resolveRequestedPaymentMethod({
    requested: parsed.data.paymentMethod,
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalOffered,
  });
  if (method === "unavailable") {
    return NextResponse.json({ error: PAYPAL_SETUP }, { status: 503 });
  }
  if (method === "bank_transfer" && !bankTransferConfigured()) {
    return NextResponse.json({ error: BANK_TRANSFER_SETUP }, { status: 503 });
  }
  if (method === "paypal" && !paypalConfigured()) {
    return NextResponse.json({ error: PAYPAL_SETUP }, { status: 503 });
  }

  try {
    if (method === "bank_transfer") {
      const order = await createBankTransferOrder({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        shipping: parsed.data.shipping,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      });
      return NextResponse.json({
        provider: method,
        reference: order.reference,
        redirectUrl: order.redirectUrl,
        amountCents: order.totalCents,
        currency: "aud",
      });
    }

    const redirectUrl = await withTimeout(
      createPaypalCheckout({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        shipping: parsed.data.shipping,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      }),
      PROVIDER_TIMEOUT_MS,
      "PayPal",
    );
    return NextResponse.json({ provider: method, redirectUrl });
  } catch (error) {
    if (error instanceof PaypalOrderSavedError) {
      return NextResponse.json({
        provider: method,
        reference: error.reference,
        redirectUrl: `/order/${error.reference}?paypal=unavailable`,
      });
    }
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("[checkout] POST failed", {
      provider: method,
      slugs: parsed.data.items.map((item) => `${item.slug}${item.option ? `:${item.option}` : ""}`),
      quantities: parsed.data.items.map((item) => item.qty),
      promoCode: parsed.data.promoCode ?? null,
      emailDomain: parsed.data.email.split("@")[1] ?? "unknown",
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: message,
    });
    const status =
      message.includes("Cart is empty") ||
      message.includes("quantity") ||
      message.includes("shipping address")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
