import { NextResponse } from "next/server";
import { createEmbeddedCheckoutSession } from "@/lib/checkout-session";
import { stripeResolved } from "@/lib/stripe";
import { checkoutBodySchema } from "@/lib/validation";

export async function GET() {
  const resolved = stripeResolved();
  return NextResponse.json({
    configured: Boolean(resolved),
    mode: resolved?.mode ?? null,
    publishableKey: resolved?.publishable ?? null,
  });
}

export async function POST(request: Request) {
  const resolved = stripeResolved();
  if (!resolved) {
    return NextResponse.json(
      {
        error:
          "Stripe is not configured with matching live keys. Add STRIPE_SECRET_KEY (sk_live_...) and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (pk_live_...).",
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
    const clientSecret = await createEmbeddedCheckoutSession({
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      promoCode: parsed.data.promoCode,
      ageConfirmed: true,
      researchUse: true,
    });
    return NextResponse.json({ clientSecret, mode: resolved.mode });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed";
    const status = message.includes("Cart is empty") || message.includes("quantity") ? 400 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
