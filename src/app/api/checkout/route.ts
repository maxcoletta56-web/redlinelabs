import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPaypalCheckout, paypalConfigured } from "@/lib/checkout-session";
import {
  checkoutSurface,
  paymentsProvider,
  paypalCheckoutOffered,
  resolveRequestedPaymentMethod,
  whopCheckoutOffered,
} from "@/lib/payments-provider";
import { PaypalOrderSavedError } from "@/lib/paypal-checkout";
import { WhopOrderSavedError, openWhopCheckout, whopCheckoutConfigured } from "@/lib/whop-checkout";
import { whopEnvironment } from "@/lib/whop";
import { resolvePaypal } from "@/lib/paypal";
import { checkoutBodySchema } from "@/lib/validation";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYPAL_SETUP =
  "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. Production uses the live PayPal API.";

const WHOP_SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY and DATABASE_URL. Sandbox is the default until WHOP_ENV=live.";

export async function GET() {
  const provider = paymentsProvider();
  const paypalReady = paypalConfigured();
  const bankReady = bankTransferConfigured();
  const whopReady = whopCheckoutConfigured();
  const surface = checkoutSurface({
    envValue: process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
    whopConfigured: whopReady,
  });
  return NextResponse.json({
    provider,
    configured: surface.setup === null,
    showChoice: surface.showChoice,
    defaultMethod: surface.defaultMethod,
    methods: surface.methods,
    setup: surface.setup,
    paypalOffered: surface.paypalOffered,
    whopOffered: surface.whopOffered,
    paypalConfigured: paypalReady,
    bankTransferConfigured: bankReady,
    whopConfigured: whopReady,
    mode: paypalReady ? (resolvePaypal(process.env)?.mode ?? null) : null,
    whopEnvironment: whopReady ? whopEnvironment(process.env) : null,
  });
}

export async function POST(request: Request) {
  const paypalOffered = paypalCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    paypalConfigured(),
  );
  const whopOffered = whopCheckoutOffered(
    process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER,
    whopCheckoutConfigured(),
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
    whopOffered,
  });
  if (method === "unavailable") {
    return NextResponse.json(
      { error: parsed.data.paymentMethod === "whop" ? WHOP_SETUP : PAYPAL_SETUP },
      { status: 503 },
    );
  }
  if (method === "bank_transfer" && !bankTransferConfigured()) {
    return NextResponse.json({ error: BANK_TRANSFER_SETUP }, { status: 503 });
  }
  if (method === "paypal" && !paypalConfigured()) {
    return NextResponse.json({ error: PAYPAL_SETUP }, { status: 503 });
  }
  if (method === "whop" && !whopCheckoutConfigured()) {
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
        openWhopCheckout({
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
        "Card checkout",
      );
      return NextResponse.json({
        provider: method,
        reference: session.reference,
        sessionId: session.sessionId,
        planId: session.planId,
        environment: session.environment,
        returnUrl: session.returnUrl,
        amountCents: session.totalCents,
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
      return NextResponse.json(
        {
          error: "Card checkout did not start. Nothing has been charged.",
          reference: error.reference,
        },
        { status: 502 },
      );
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
