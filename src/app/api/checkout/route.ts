import { NextResponse } from "next/server";
import { ordersConfigured } from "@/lib/orders-db";
import { placeCheckoutOrder } from "@/lib/place-checkout";
import { whopConfigured, whopMode } from "@/lib/whop-checkout";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { checkoutBodySchema } from "@/lib/validation";

export const runtime = "nodejs";

function originFrom(request: Request) {
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return host ? `${proto}://${host}` : url.origin;
}

export async function GET() {
  return NextResponse.json({
    card: whopConfigured(process.env) && ordersConfigured(),
    bank: ordersConfigured(),
    environment: whopMode(process.env),
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`checkout:${clientKey(request)}`, 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json({ error: "Too many checkout attempts. Try again shortly." }, { status: 429 });
  }
  if (!ordersConfigured()) {
    return NextResponse.json({ error: "Order storage is not configured" }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }
  const parsed = checkoutBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" },
      { status: 400 },
    );
  }
  if (parsed.data.paymentMethod === "card" && !whopConfigured(process.env)) {
    return NextResponse.json({ error: "Card checkout is not configured" }, { status: 503 });
  }

  try {
    const started = await placeCheckoutOrder({
      ...parsed.data,
      origin: originFrom(request),
    });
    return NextResponse.json(started);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    const status = message.includes("Cart is empty") || message.includes("quantity") || message.includes("option")
      ? 400
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
