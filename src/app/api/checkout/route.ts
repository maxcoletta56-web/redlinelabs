import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, payoneerConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { resolvePayoneer } from "@/lib/payoneer";
import { checkoutBodySchema } from "@/lib/validation";
import { createWhopCardCheckout, whopCardCheckoutConfigured } from "@/lib/whop-checkout";
import { resolveWhop, whopEmbedEnvironment } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYONEER_SETUP =
  "Payoneer is not configured. Add PAYONEER_MERCHANT_CODE and PAYONEER_PAYMENT_TOKEN. Production uses the live Payoneer API.";

const CARD_SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, and DATABASE_URL.";

export async function GET() {
  const provider = paymentsProvider();
  const whop = resolveWhop(process.env);
  const card = whopCardCheckoutConfigured();
  const bankTransfer = bankTransferConfigured();
  return NextResponse.json({
    provider,
    configured: card || bankTransfer || (provider === "stripe" && payoneerConfigured()),
    card,
    bankTransfer,
    cardEnvironment: whop ? whopEmbedEnvironment(whop.environment) : "sandbox",
    mode: provider === "stripe" ? (resolvePayoneer(process.env)?.mode ?? null) : null,
  });
}

export async function POST(request: Request) {
  const provider = paymentsProvider();

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

  const paymentMethod =
    json && typeof json === "object" && !Array.isArray(json) && "paymentMethod" in json
      ? (json as { paymentMethod?: unknown }).paymentMethod
      : null;

  try {
    if (paymentMethod === "card") {
      if (!whopCardCheckoutConfigured()) {
        return NextResponse.json({ error: CARD_SETUP }, { status: 503 });
      }
      const checkout = await withTimeout(
        createWhopCardCheckout({
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
        "The card processor",
      );
      return NextResponse.json({
        provider: "card",
        reference: checkout.reference,
        sessionId: checkout.sessionId,
        planId: checkout.planId,
        environment: checkout.environment,
        returnUrl: checkout.returnUrl,
        amountCents: checkout.totalCents,
        currency: "aud",
      });
    }

    if (paymentMethod === "bank_transfer" || provider === "bank_transfer") {
      if (!bankTransferConfigured()) {
        return NextResponse.json({ error: BANK_TRANSFER_SETUP }, { status: 503 });
      }
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
        provider: paymentMethod === "bank_transfer" ? "bank_transfer" : provider,
        reference: order.reference,
        redirectUrl: order.redirectUrl,
        amountCents: order.totalCents,
        currency: "aud",
      });
    }

    if (!payoneerConfigured()) {
      return NextResponse.json({ error: PAYONEER_SETUP }, { status: 503 });
    }
    const redirectUrl = await withTimeout(
      createPayoneerCheckout({
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
      "The card processor",
    );
    return NextResponse.json({ provider, redirectUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("[checkout] POST failed", {
      provider,
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
