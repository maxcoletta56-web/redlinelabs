import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { normalizeOrderReference } from "@/lib/order-reference";
import { findOrder, markOrderPaid, ordersConfigured } from "@/lib/orders";
import { scheduleEmail } from "@/lib/schedule-email";

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

  try {
    const existing = await findOrder(normalized).catch((error: unknown) => {
      console.error("[admin] order lookup before paid email failed", {
        reference: normalized,
        errorName: error instanceof Error ? error.name : "unknown",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    });
    const order = await markOrderPaid(normalized);
    if (!order) {
      return NextResponse.json({ error: "Order was not found" }, { status: 404 });
    }
    if (existing?.status !== "paid") {
      scheduleEmail(order.reference, () =>
        sendPaymentReceivedEmail({
          reference: order.reference,
          firstName: order.firstName,
          email: order.email,
          totalCents: order.totalCents,
        }),
      );
    }
    return NextResponse.json({
      reference: order.reference,
      status: order.status,
      totalCents: order.totalCents,
      currency: order.currency,
      paidAt: order.paidAt,
    });
  } catch (error) {
    console.error("[admin] mark order paid failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not update that order" }, { status: 500 });
  }
}
