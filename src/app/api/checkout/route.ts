import { NextResponse } from "next/server";
import { bankTransferConfigured, createBankTransferOrder } from "@/lib/bank-transfer-checkout";
import { checkoutBodySchema } from "@/lib/validation";
import { withTimeout } from "@/lib/with-timeout";
import { createWhopCardCheckout, whopCardConfigured } from "@/lib/whop-checkout";
import { resolveWhop } from "@/lib/whop";

/** A hung card processor must not leave the browser on a spinner forever. */
const PROVIDER_TIMEOUT_MS = 15_000;

const BANK_TRANSFER_SETUP =
  "Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME, and DATABASE_URL.";

const WHOP_SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, WHOP_WEBHOOK_SECRET, and DATABASE_URL.";

export async function GET() {
  const whop = resolveWhop(process.env);
  return NextResponse.json({
    card: {
      provider: "whop",
      configured: whopCardConfigured(),
      environment: whop?.environment ?? "sandbox",
    },
    bankTransfer: {
      configured: bankTransferConfigured(),
    },
  });
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const record = json && typeof json === "object" ? (json as { method?: unknown }) : {};
  const method = record.method === "card" ? "card" : record.method === "bank_transfer" ? "bank_transfer" : null;
  if (!method) {
    return NextResponse.json({ error: "Choose card or bank transfer" }, { status: 400 });
  }

  const configured = method === "bank_transfer" ? bankTransferConfigured() : whopCardConfigured();
  if (!configured) {
    return NextResponse.json(
      { error: method === "bank_transfer" ? BANK_TRANSFER_SETUP : WHOP_SETUP },
      { status: 503 },
    );
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
        shipping: parsed.data.shipping,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      });
      return NextResponse.json({
        method,
        reference: order.reference,
        redirectUrl: order.redirectUrl,
        amountCents: order.totalCents,
        currency: "aud",
      });
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
      "Whop",
    );
    return NextResponse.json({
      method,
      reference: session.reference,
      sessionId: session.sessionId,
      planId: session.planId,
      environment: session.environment,
      returnUrl: session.returnUrl,
      amountCents: session.totalCents,
      currency: "aud",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    console.error("[checkout] POST failed", {
      method,
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
    const publicMessage =
      method === "bank_transfer"
        ? "We could not create your order. Nothing has been charged."
        : "Card checkout did not start. Nothing has been charged.";
    return NextResponse.json({ error: publicMessage }, { status });
  }
}
