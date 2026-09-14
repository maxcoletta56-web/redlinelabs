import { NextResponse } from "next/server";
import { createEmbeddedCheckoutSession } from "@/lib/checkout-session";
import { type CartLineInput } from "@/lib/order";
import { stripeConfigured } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({ configured: stripeConfigured() });
}

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY." },
      { status: 503 },
    );
  }

  let body: {
    email?: string;
    firstName?: string;
    lastName?: string;
    ageConfirmed?: boolean;
    researchUse?: boolean;
    items?: CartLineInput[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
  }
  if (!body.ageConfirmed || !body.researchUse) {
    return NextResponse.json(
      { error: "Age and research-use confirmation are required" },
      { status: 400 },
    );
  }

  try {
    const clientSecret = await createEmbeddedCheckoutSession({
      items: body.items ?? [],
      email,
      firstName: body.firstName,
      lastName: body.lastName,
    });
    return NextResponse.json({ clientSecret });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
