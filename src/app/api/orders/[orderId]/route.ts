import { NextResponse } from "next/server";
import { getOrderStore } from "@/lib/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ORDER_ID = /^ord_[0-9a-f-]{36}$/i;

export async function GET(_request: Request, context: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await context.params;
  if (!ORDER_ID.test(orderId)) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }
  const order = await getOrderStore().find(orderId);
  if (!order) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  return NextResponse.json({
    id: order.id,
    status: order.status,
    payment_status: order.status === "paid" ? "paid" : order.status,
    email: order.status === "paid" ? order.email : null,
    amount_total: order.totalCents,
    amount_subtotal: order.subtotalCents,
    currency: order.currency,
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
