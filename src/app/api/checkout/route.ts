import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPayoneerCheckout, payoneerConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { resolvePayoneer } from "@/lib/payoneer";
import { checkoutBodySchema } from "@/lib/validation";
import { whopCardConfigured, createWhopCardCheckout } from "@/lib/whop-checkout";
import { whopEnvironment } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYONEER_SETUP =
  "Payoneer is not configured. Add PAYONEER_MERCHANT_CODE and PAYONEER_PAYMENT_TOKEN. Production uses the live Payoneer API.";

function checkoutMethod(value: unknown) {
  return value === "card" || value === "bank_transfer" ? value : null;
}

export async function GET() {
  const provider = paymentsProvider();
  const bank = bankTransferConfigured();
  const card = whopCardConfigured();
  return NextResponse.json({
    provider,
    configured: provider === "bank_transfer" ? bank : payoneerConfigured(),
    mode: provider === "bank_transfer" ? null : (resolvePayoneer(process.env)?.mode ?? null),
    bankTransfer: { configured: bank },
    card: { configured: card, environment: whopEnvironment() },
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

  const method = checkoutMethod(
    json && typeof json === "object" ? (json as { method?: unknown }).method : null,
  );

  try {
    if (method === "card") {
      if (!whopCardConfigured()) {
        return NextResponse.json(
          { error: "Card checkout is not configured. Add WHOP_API_KEY, WHOP_WEBHOOK_SECRET, WHOP_COMPANY_ID, and DATABASE_URL." },
          { status: 503 },
        );
      }
      const session = await withTimeout(
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
        reference: session.reference,
        sessionId: session.sessionId,
        planId: session.planId,
        environment: session.environment,
        returnUrl: session.returnUrl,
        amountCents: session.totalCents,
        currency: "aud",
      });
    }

    if (method === "bank_transfer" || (!method && provider === "bank_transfer")) {
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
        provider,
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
