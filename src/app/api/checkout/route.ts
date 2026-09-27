import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, payoneerConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { resolvePayoneer } from "@/lib/payoneer";
import { checkoutBodySchema } from "@/lib/validation";
import { whopCheckoutConfigured, whopEnvironment } from "@/lib/whop-env";
import { openWhopCardCheckout } from "@/lib/whop-checkout";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYONEER_SETUP =
  "Payoneer is not configured. Add PAYONEER_MERCHANT_CODE and PAYONEER_PAYMENT_TOKEN. Production uses the live Payoneer API.";

export async function GET() {
  const provider = paymentsProvider();
  return NextResponse.json({
    provider,
    configured: bankTransferConfigured() || whopCheckoutConfigured(),
    bankTransferConfigured: bankTransferConfigured(),
    cardConfigured: whopCheckoutConfigured(),
    cardEnvironment: whopEnvironment(),
    mode: provider === "bank_transfer" ? null : resolvePayoneer(process.env)?.mode ?? null,
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
      ? String((json as { paymentMethod?: unknown }).paymentMethod ?? "")
      : "";

  if (paymentMethod === "card") {
    if (!whopCheckoutConfigured()) {
      return NextResponse.json(
        {
          error:
            "Card checkout is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, WHOP_WEBHOOK_SECRET, and DATABASE_URL.",
        },
        { status: 503 },
      );
    }
  } else {
    const configured = provider === "bank_transfer" ? bankTransferConfigured() : payoneerConfigured();
    if (!configured) {
      return NextResponse.json(
        { error: provider === "bank_transfer" ? BANK_TRANSFER_SETUP : PAYONEER_SETUP },
        { status: 503 },
      );
    }
  }

  try {
    if (paymentMethod === "card") {
      const origin = new URL(request.url).origin;
      const session = await openWhopCardCheckout({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
        origin,
      });
      return NextResponse.json({
        provider: "whop",
        reference: session.reference,
        sessionId: session.sessionId,
        planId: session.planId,
        environment: session.environment,
        returnUrl: session.returnUrl,
      });
    }

    if (provider === "bank_transfer") {
      const order = await createBankTransferOrder({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      });
      return NextResponse.json({
        provider,
        reference: order.reference,
        redirectUrl: order.redirectUrl,
        amountCents: order.totalCents,
        currency: "aud",
      });
    }

    const redirectUrl = await withTimeout(
      createPayoneerCheckout({
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
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
    const status = message.includes("Cart is empty") || message.includes("quantity") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
