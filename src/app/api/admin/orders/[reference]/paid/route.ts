import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { normalizeOrderReference } from "@/lib/order-reference";
import { ordersConfigured } from "@/lib/orders";
import { recordAdminPayment } from "@/lib/record-admin-payment";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ reference: string }> },
) {
  if (!authorizeAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ordersConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  }

  const { reference } = await context.params;
  const normalized = normalizeOrderReference(reference);
  if (!normalized) {
    return NextResponse.json({ error: "Invalid order reference" }, { status: 400 });
  }

  const result = await recordAdminPayment(normalized);
  if (!result.ok && result.reason === "missing") {
    return NextResponse.json({ error: "Order was not found" }, { status: 404 });
  }
  if (!result.ok) {
    return NextResponse.json({ error: "Could not update that order" }, { status: 500 });
  }

  const { order } = result;
  return NextResponse.json({
    reference: order.reference,
    status: order.status,
    totalCents: order.totalCents,
    currency: order.currency,
    paidAt: order.paidAt,
  });
}
