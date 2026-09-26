import { NextRequest, NextResponse } from "next/server";
import { loadPayoneerReceipt, payoneerConfigured } from "@/lib/checkout-session";
import { checkoutSessionQuerySchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!payoneerConfigured()) {
    return NextResponse.json({ error: "Payoneer is not configured" }, { status: 503 });
  }

  const parsed = checkoutSessionQuerySchema.safeParse({
    session_id: request.nextUrl.searchParams.get("session_id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing checkout session" }, { status: 400 });
  }

  try {
    const loaded = await loadPayoneerReceipt(parsed.data.session_id);
    if (!loaded) {
      return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
    }
    const { receipt, list, paid } = loaded;
    return NextResponse.json({
      id: receipt.transactionId,
      status: paid ? "complete" : list.statusCode,
      payment_status: paid ? "paid" : list.statusCode,
      email: receipt.email,
      amount_total: receipt.amountCents,
      amount_subtotal: receipt.subtotalCents,
      currency: receipt.currency,
      store_credit_cents: 0,
      promo_code: receipt.promoCode || null,
      promo_percent_off: receipt.promoPercentOff,
      line_items: receipt.lines.map((line) => ({
        slug: line.slug,
        name: line.name,
        option: line.option,
        sku: line.sku,
        qty: line.qty,
        unit_amount: line.unitAmountCents,
      })),
      shipping: receipt.shipping
        ? {
            name: receipt.shipping.name,
            phone: null,
            address: {
              line1: receipt.shipping.line1,
              line2: receipt.shipping.line2 ?? null,
              city: receipt.shipping.city,
              state: receipt.shipping.state,
              postal_code: receipt.shipping.postal_code,
              country: receipt.shipping.country ?? "AU",
            },
          }
        : null,
    });
  } catch {
    return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
  }
}
