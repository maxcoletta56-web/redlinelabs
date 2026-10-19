import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { authorizeAdmin } from "@/lib/admin-auth";
import { normalizeOrderReference } from "@/lib/order-reference";
import { cancelOrderAndReleasePoints, ordersConfigured } from "@/lib/orders";

/** Cancels an unpaid order and returns any Club points reserved for it. */
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
    const result = await cancelOrderAndReleasePoints(normalized);
    if (result.outcome === "missing") {
      return NextResponse.json({ error: "Order was not found" }, { status: 404 });
    }
    if (result.outcome === "paid") {
      return NextResponse.json({ error: "A paid order cannot be cancelled" }, { status: 409 });
    }
    return NextResponse.json({
      reference: result.order.reference,
      status: result.order.status,
      clubPointsReleased: !result.releaseFailed,
    });
  } catch (error) {
    console.error("[admin] cancel order failed", {
      reference: normalized,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Could not update that order" }, { status: 500 });
  }
}
