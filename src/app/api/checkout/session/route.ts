import { NextRequest, NextResponse } from "next/server";
import { loadPayoneerReceipt, payoneerConfigured } from "@/lib/checkout-session";
import { createNeonOrderStore, ordersConfigured } from "@/lib/orders-db";
import { checkoutSessionQuerySchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const parsed = checkoutSessionQuerySchema.safeParse({
    session_id: request.nextUrl.searchParams.get("session_id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing checkout session" }, { status: 400 });
  }

  if (ordersConfigured()) {
    const order = await createNeonOrderStore().get(parsed.data.session_id);
    if (order) {
      const paid = order.status === "paid";
      return NextResponse.json({
        id: order.id,
        status: paid ? "complete" : order.status,
        payment_status: paid ? "paid" : order.status,
        email: order.email,
        amount_total: order.totalCents,
        amount_subtotal: order.subtotalCents,
        currency: order.currency,
        store_credit_cents: 0,
        promo_code: order.promoCode || null,
        promo_percent_off: 0,
        line_items: order.lines.map((line) => ({
          slug: line.slug,
          name: line.name,
          option: line.option,
          sku: line.sku,
          qty: line.qty,
          unit_amount: line.unitAmountCents,
        })),
        shipping: order.shipping
          ? {
              name: order.shipping.name,
              phone: null,
              address: {
                line1: order.shipping.line1,
                line2: order.shipping.line2 ?? null,
                city: order.shipping.city,
                state: order.shipping.state,
                postal_code: order.shipping.postal_code,
                country: order.shipping.country ?? "AU",
              },
            }
          : null,
      });
    }
  }

  if (!payoneerConfigured()) {
    return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
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
