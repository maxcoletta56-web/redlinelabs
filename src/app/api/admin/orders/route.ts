import { NextResponse } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { listRecentOrders, ordersConfigured } from "@/lib/orders";

export async function GET(request: Request) {
  if (!authorizeAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!ordersConfigured()) {
    return NextResponse.json({ error: "DATABASE_URL is not set" }, { status: 503 });
  }

  try {
    const orders = await listRecentOrders(50);
    return NextResponse.json({
      orders: orders.map((order) => ({
        reference: order.reference,
        status: order.status,
        totalCents: order.totalCents,
        currency: order.currency,
        email: order.email,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
      })),
    });
  } catch (error) {
    console.error("[admin] list orders failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Could not list orders" }, { status: 500 });
  }
}
