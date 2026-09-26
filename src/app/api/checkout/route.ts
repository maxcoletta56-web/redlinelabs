import { NextResponse } from "next/server";
import { createCheckoutOrder } from "@/lib/checkout-order";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { checkoutBodySchema } from "@/lib/validation";
import { resolveWhopEnvironment, resolveWhop } from "@/lib/whop-config";
import { whopConfigured } from "@/lib/whop";

export const dynamic = "force-dynamic";

export async function GET() {
  const resolved = resolveWhop(process.env);
  return NextResponse.json({
    configured: whopConfigured(),
    environment: resolved?.environment ?? resolveWhopEnvironment(process.env),
  });
}

export async function POST(request: Request) {
  const limited = rateLimit(`checkout:${clientKey(request)}`, 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
    );
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

  try {
    const prepared = await createCheckoutOrder({
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      promoCode: parsed.data.promoCode,
      ageConfirmed: true,
      researchUse: true,
      paymentMethod: parsed.data.paymentMethod,
    });
    return NextResponse.json(prepared);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    const status = message.includes("not configured")
      ? 503
      : message.includes("Cart is empty") || message.includes("quantity") || message.includes("total")
        ? 400
        : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
