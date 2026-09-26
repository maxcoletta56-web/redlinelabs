import { NextResponse } from "next/server";
import { createPayoneerCheckout, payoneerConfigured } from "@/lib/checkout-session";
import { resolvePayoneer } from "@/lib/payoneer";
import { checkoutBodySchema } from "@/lib/validation";
import { resolveWhop, whopConfigured } from "@/lib/whop";

export async function GET() {
  const resolved = resolvePayoneer(process.env);
  const whop = resolveWhop(process.env);
  return NextResponse.json({
    configured: payoneerConfigured() || whopConfigured(),
    payoneer: payoneerConfigured(),
    whop: whopConfigured(),
    mode: resolved?.mode ?? null,
    whopEnvironment: whop?.mode ?? null,
  });
}

export async function POST(request: Request) {
  if (!payoneerConfigured()) {
    return NextResponse.json(
      {
        error:
          "Payoneer is not configured. Add PAYONEER_MERCHANT_CODE and PAYONEER_PAYMENT_TOKEN. Production uses the live Payoneer API.",
      },
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
    const redirectUrl = await createPayoneerCheckout({
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      promoCode: parsed.data.promoCode,
      ageConfirmed: true,
      researchUse: true,
    });
    return NextResponse.json({ redirectUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payoneer checkout failed";
    const status = message.includes("Cart is empty") || message.includes("quantity") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
