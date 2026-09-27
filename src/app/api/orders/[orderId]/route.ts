import { NextResponse } from "next/server";
import { OrdersUnavailableError, getOrderStore } from "@/lib/orders-db";
import { isOrderId, publicOrder } from "@/lib/orders";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orderId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { orderId } = await params;
  if (!isOrderId(orderId)) {
    return NextResponse.json({ error: "Unknown order" }, { status: 404 });
  }
  try {
    const store = await getOrderStore();
    const order = await store.get(orderId);
    if (!order) return NextResponse.json({ error: "Unknown order" }, { status: 404 });
    return NextResponse.json(publicOrder(order));
  } catch (error) {
    if (error instanceof OrdersUnavailableError) {
      return NextResponse.json({ error: "Orders are not configured" }, { status: 503 });
    }
    return NextResponse.json({ error: "Order could not be loaded" }, { status: 500 });
  }
}
