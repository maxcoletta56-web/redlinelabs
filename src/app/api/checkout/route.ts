import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, payoneerConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { resolvePayoneer } from "@/lib/payoneer";
import { checkoutBodySchema } from "@/lib/validation";
import { createWhopCardCheckout, whopCardConfigured, whopCardEnvironment } from "@/lib/whop-checkout";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYONEER_SETUP =
  "Payoneer is not configured. Add PAYONEER_MERCHANT_CODE and PAYONEER_PAYMENT_TOKEN. Production uses the live Payoneer API.";

const WHOP_SETUP =
  "Whop is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, and DATABASE_URL.";

export async function GET() {
  const bank = bankTransferConfigured();
  const card = whopCardConfigured();
  return NextResponse.json({
    provider: paymentsProvider(),
    configured: bank || card,
    bankTransferConfigured: bank,
    cardConfigured: card,
    cardEnvironment: whopCardEnvironment(),
    mode: resolvePayoneer(process.env)?.mode ?? null,
  });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const requested = (json as { paymentMethod?: unknown } | null)?.paymentMethod;
  const method =
    requested === "card" || requested === "bank_transfer" ? requested : paymentsProvider();
  const configured =
    method === "card"
      ? whopCardConfigured()
      : method === "bank_transfer"
        ? bankTransferConfigured()
        : payoneerConfigured();
  if (!configured) {
    const error =
      method === "card" ? WHOP_SETUP : method === "bank_transfer" ? BANK_TRANSFER_SETUP : PAYONEER_SETUP;
    return NextResponse.json({ error }, { status: 503 });
  }

  const parsed = checkoutBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" },
      { status: 400 },
    );
  }

  try {
    if (method === "bank_transfer") {
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
        provider: method,
        reference: order.reference,
        redirectUrl: order.redirectUrl,
        amountCents: order.totalCents,
        currency: "aud",
      });
    }

    if (method === "card") {
      const checkout = await withTimeout(
        createWhopCardCheckout({
          items: parsed.data.items,
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          promoCode: parsed.data.promoCode,
          ageConfirmed: true,
          researchUse: true,
        }),
        PROVIDER_TIMEOUT_MS,
        "Whop",
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
    return NextResponse.json({ provider: method, redirectUrl });
  } catch (error) {
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
    const status = message.includes("Cart is empty") || message.includes("quantity") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
