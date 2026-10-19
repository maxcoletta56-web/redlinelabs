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
import { createWhopCardCheckout, WhopOrderSavedError } from "@/lib/whop-checkout";
import { whopConfigured, whopEnvironmentName } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYPAL_SETUP =
  "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. Production uses the live PayPal API.";

const WHOP_SETUP = "Card checkout is not configured. Add WHOP_API_KEY.";

export async function GET() {
  const provider = paymentsProvider();
  const paypalReady = paypalConfigured();
  const bankReady = bankTransferConfigured();
  const cardReady = whopConfigured();
  const surface = checkoutSurface({
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
    whopConfigured: cardReady,
  });
  return NextResponse.json({
    provider,
    configured: surface.setup === null,
    showChoice: surface.showChoice,
    defaultMethod: surface.defaultMethod,
    methods: surface.methods,
    setup: surface.setup,
    paypalOffered: surface.methods.includes("paypal"),
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
    whopOffered: surface.methods.includes("whop"),
    whopEnvironment: cardReady ? whopEnvironmentName() : null,
    mode: paypalReady ? (resolvePaypal(process.env)?.mode ?? null) : null,
  });
}

export async function POST(request: Request) {
  const paypalOffered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );
  const cardOffered = whopConfigured();

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
    whopOffered: cardOffered,
  });
  if (method === "unavailable") {
    const requested = parsed.data.paymentMethod;
    return NextResponse.json(
      { error: requested === "whop" ? WHOP_SETUP : PAYPAL_SETUP },
      { status: 503 },
    );
  }
  if (method === "bank_transfer" && !bankTransferConfigured()) {
    return NextResponse.json({ error: BANK_TRANSFER_SETUP }, { status: 503 });
  }
  if (method === "paypal" && !paypalConfigured()) {
    return NextResponse.json({ error: PAYPAL_SETUP }, { status: 503 });
  }
  if (method === "whop" && !cardOffered) {
    return NextResponse.json({ error: WHOP_SETUP }, { status: 503 });
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
        club: parsed.data.club,
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

    if (method === "whop") {
      const session = await withTimeout(
        createWhopCardCheckout({
          items: parsed.data.items,
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          shipping: parsed.data.shipping,
          promoCode: parsed.data.promoCode,
          club: parsed.data.club,
          ageConfirmed: true,
          researchUse: true,
        }),
        PROVIDER_TIMEOUT_MS,
        "Card checkout",
      );
      return NextResponse.json({
        provider: method,
        reference: session.reference,
        sessionId: session.sessionId,
        planId: session.planId,
        returnUrl: session.returnUrl,
        environment: session.environment,
        amountCents: session.amountCents,
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
    if (error instanceof WhopOrderSavedError) {
      return NextResponse.json({
        provider: method,
        reference: error.reference,
        redirectUrl: `/order/${error.reference}`,
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
