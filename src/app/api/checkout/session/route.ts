import { NextRequest, NextResponse } from "next/server";
import { getOrderStore } from "@/lib/order-store";
import type { ServerOrder } from "@/lib/server-order";
import { checkoutSessionQuerySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

function sessionFromOrder(order: ServerOrder) {
  const paid = order.status === "paid";
  return {
    id: order.id,
    status: paid ? "complete" : order.status,
    payment_status: paid ? "paid" : order.status,
    payment_method: order.paymentMethod,
    email: order.email,
    amount_total: order.totalCents,
    amount_subtotal: order.subtotalCents,
    currency: order.currency,
    store_credit_cents: 0,
    promo_code: order.promoCode || null,
    promo_percent_off: order.promoPercentOff,
    volume_discount_cents: order.volumeDiscountCents,
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
  };
}

export async function GET(request: NextRequest) {
  const parsed = checkoutSessionQuerySchema.safeParse({
    session_id: request.nextUrl.searchParams.get("session_id") ?? request.nextUrl.searchParams.get("order_id"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Missing checkout session" }, { status: 400 });
  }

  const order = await getOrderStore().get(parsed.data.session_id);
  if (!order) {
    return NextResponse.json({ error: "Checkout session was not found" }, { status: 404 });
  }
  return NextResponse.json(sessionFromOrder(order));
}
