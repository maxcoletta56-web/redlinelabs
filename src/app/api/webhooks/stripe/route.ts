import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe, webhookSecret } from "@/lib/stripe";

function orderSummary(session: Stripe.Checkout.Session) {
  return {
    session: session.id,
    email: session.customer_details?.email ?? session.customer_email,
    amount_total: session.amount_total,
    currency: session.currency,
    payment_status: session.payment_status,
  };
}

export async function POST(request: Request) {
  const secret = webhookSecret();
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // Signature verification needs the exact bytes Stripe signed, so read the body as text.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signature verification failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object;
      if (session.payment_status === "paid") {
        console.info("[stripe] paid", orderSummary(session));
      } else {
        console.info("[stripe] awaiting payment", orderSummary(session));
      }
      break;
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      console.warn(`[stripe] ${event.type}`, orderSummary(event.data.object));
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
