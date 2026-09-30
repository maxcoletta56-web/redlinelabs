import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { paymentsProvider } from "@/lib/payments-provider";
import { checkoutBodySchema } from "@/lib/validation";
import { whopEnvironment } from "@/lib/whop";
import { createWhopCardCheckout, whopCardConfigured } from "@/lib/whop-checkout";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const WHOP_SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY, WHOP_WEBHOOK_SECRET, WHOP_COMPANY_ID, and DATABASE_URL. Sandbox is the default until WHOP_ENVIRONMENT is production.";

export async function GET() {
  const provider = paymentsProvider();
  const bank = bankTransferConfigured();
  const card = whopCardConfigured();
  return NextResponse.json({
    provider,
    configured: bank || card,
    mode: whopEnvironment(),
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

  const method =
    parsed.data.paymentMethod ?? (provider === "bank_transfer" ? "bank_transfer" : "card");
  if (method === "card" && !whopCardConfigured()) {
    return NextResponse.json({ error: WHOP_SETUP }, { status: 503 });
  }
  if (method === "bank_transfer" && !bankTransferConfigured()) {
    return NextResponse.json({ error: BANK_TRANSFER_SETUP }, { status: 503 });
  }

  try {
    if (method === "card") {
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
      provider: "bank_transfer",
      reference: order.reference,
      redirectUrl: order.redirectUrl,
      amountCents: order.totalCents,
      currency: "aud",
    });
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
    const safe =
      method === "bank_transfer"
        ? "We could not create your order. Nothing has been charged."
        : "The card processor did not respond. Nothing has been charged.";
    return NextResponse.json({ error: safe }, { status });
  }
}
