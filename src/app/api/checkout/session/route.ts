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
      expand: ["line_items", "line_items.data.price.product"],
    });
    const shipping = session.collected_information?.shipping_details ?? null;
    const lineItems = (session.line_items?.data ?? []).map((item) => {
      const product = item.price?.product;
      const metadata =
        product && typeof product !== "string" && "metadata" in product
          ? product.metadata
          : {};
      return {
        slug: metadata.slug ?? null,
        name: item.description,
        option: metadata.option || null,
        sku: metadata.sku ?? null,
        qty: item.quantity,
        unit_amount: item.price?.unit_amount ?? item.amount_total,
      };
    });
    return NextResponse.json({
      id: session.id,
      status: session.status,
      payment_status: session.payment_status,
      email: session.customer_details?.email ?? session.customer_email,
      amount_total: session.amount_total,
      amount_subtotal: session.amount_subtotal,
      currency: session.currency,
      store_credit_cents: Number(session.metadata?.store_credit_cents ?? 0),
      promo_code: session.metadata?.promo_code || null,
      promo_percent_off: Number(session.metadata?.promo_percent_off ?? 0),
      line_items: lineItems,
      shipping: shipping
        ? {
            name: shipping.name,
            phone: session.customer_details?.phone ?? null,
            address: shipping.address,
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
  }
}
