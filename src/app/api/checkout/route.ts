import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { createPaypalCheckout, paypalConfigured } from "@/lib/checkout-session";
import { paymentsProvider } from "@/lib/payments-provider";
import { resolvePaypal } from "@/lib/paypal";
import { checkoutBodySchema } from "@/lib/validation";
import { createWhopCardCheckout, whopCheckoutConfigured } from "@/lib/whop-checkout";
import { whopEnvironment, whopReturnOrigin } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const PAYPAL_SETUP =
  "PayPal is not configured. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET. Production uses the live PayPal API.";

const CARD_SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, and DATABASE_URL.";

function requestedMethod(value: unknown): "whop" | "bank_transfer" | "paypal" | null {
  if (!value || typeof value !== "object") return null;
  const method = (value as { method?: unknown }).method;
  if (method === "whop" || method === "card") return "whop";
  if (method === "bank_transfer") return "bank_transfer";
  if (method === "paypal") return "paypal";
  return null;
}

export async function GET() {
  const provider = paymentsProvider();
  const card = whopCheckoutConfigured();
  const bankTransfer = bankTransferConfigured();
  return NextResponse.json({
    provider,
    configured: card || bankTransfer || (provider === "paypal" && paypalConfigured()),
    mode: card ? whopEnvironment() : provider === "paypal" ? (resolvePaypal(process.env)?.mode ?? null) : null,
    card: { configured: card, environment: card ? whopEnvironment() : null, provider: "whop" },
    bankTransfer: { configured: bankTransfer },
  });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const method = requestedMethod(json) ?? (paymentsProvider() === "paypal" ? "paypal" : "bank_transfer");
  const configured =
    method === "whop"
      ? whopCheckoutConfigured()
      : method === "bank_transfer"
        ? bankTransferConfigured()
        : paypalConfigured();
  if (!configured) {
    const error = method === "whop" ? CARD_SETUP : method === "bank_transfer" ? BANK_TRANSFER_SETUP : PAYPAL_SETUP;
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
    if (method === "whop") {
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
          returnOrigin: whopReturnOrigin(request.headers),
        }),
        PROVIDER_TIMEOUT_MS,
        "Whop",
      );
      return NextResponse.json({
        provider: "whop",
        reference: session.reference,
        sessionId: session.sessionId,
        environment: session.environment,
        returnUrl: session.returnUrl,
        amountCents: session.amountCents,
        currency: "aud",
      });
    }

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
        provider: "bank_transfer",
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
    return NextResponse.json({ provider: "paypal", redirectUrl });
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
    const status =
      message.includes("Cart is empty") ||
      message.includes("quantity") ||
      message.includes("shipping address")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
