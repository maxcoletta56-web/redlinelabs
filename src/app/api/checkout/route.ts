import { NextResponse } from "next/server";
import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { checkoutOrigin, getStripe, stripeConfigured } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({ configured: stripeConfigured() });
}

export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured. Add STRIPE_SECRET_KEY on the server." },
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

  let lines;
  try {
    lines = resolveCartLines(body.items ?? []);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cart could not be priced" },
      { status: 400 },
    );
  }

  const origin = checkoutOrigin(request);
  const name = [body.firstName, body.lastName].filter(Boolean).join(" ").trim();

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: email,
      client_reference_id: email,
      billing_address_collection: "required",
      shipping_address_collection: { allowed_countries: ["AU"] },
      submit_type: "pay",
      line_items: lines.map((line) => ({
        quantity: line.qty,
        price_data: {
          currency: "aud",
          unit_amount: line.unitAmountCents,
          product_data: {
            name: lineLabel(line),
            metadata: {
              slug: line.slug,
              sku: line.sku,
              option: line.option ?? "",
            },
          },
        },
      })),
      metadata: {
        customer_name: name,
        age_confirmed: "true",
        research_use: "true",
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
    });

    if (!session.url) {
      return NextResponse.json({ error: "Stripe did not return a checkout URL" }, { status: 502 });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe checkout failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
