import { NextRequest, NextResponse } from "next/server";
import { stripe, stripeConfigured } from "@/lib/stripe";

export async function GET(request: NextRequest) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: "Stripe is not configured" }, { status: 503 });
  }

  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId || !sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "Missing checkout session" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });
    return NextResponse.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      email: session.customer_details?.email ?? session.customer_email,
      amount_total: session.amount_total,
      currency: session.currency,
    });
  } catch {
    return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
  }
}
