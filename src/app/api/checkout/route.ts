import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPaypalCheckout, paypalConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
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
  if (provider === "bank_transfer") {
    return NextResponse.json({
      provider,
      configured: bankTransferConfigured(),
      mode: null,
    });
  }
  return NextResponse.json({
    provider,
    configured: paypalConfigured(),
    mode: resolvePaypal(process.env)?.mode ?? null,
  });
}

export async function POST(request: Request) {
  const provider = paymentsProvider();
  const configured = provider === "bank_transfer" ? bankTransferConfigured() : paypalConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: provider === "bank_transfer" ? BANK_TRANSFER_SETUP : PAYPAL_SETUP },
      { status: 503 },
    );
  }

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

  try {
    if (provider === "bank_transfer") {
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
