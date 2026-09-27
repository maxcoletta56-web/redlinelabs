import { NextResponse } from "next/server";
import { absoluteUrl } from "@/lib/seo";
import { OrdersUnavailableError, getOrderStore } from "@/lib/orders-db";
import { placeOrder } from "@/lib/place-order";
import { bankTransferDetails } from "@/lib/whop-config";
import { whopConfigured } from "@/lib/whop";
import { checkoutBodySchema, type CheckoutPaymentMethod } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function startStoredCheckout(request: Request, paymentMethod: CheckoutPaymentMethod) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout payload" }, { status: 400 });
  }

  const parsed = checkoutBodySchema.safeParse({
    ...(json && typeof json === "object" ? json : {}),
    paymentMethod,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid checkout payload" },
      { status: 400 },
    );
  }

  if (paymentMethod === "card" && !whopConfigured()) {
    return NextResponse.json(
      { error: "Card checkout is not configured. Add WHOP_API_KEY and WHOP_COMPANY_ID." },
      { status: 503 },
    );
  }

  try {
    const store = await getOrderStore();
    const placed = await placeOrder(store, {
      items: parsed.data.items,
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      shipping: parsed.data.shipping,
      promoCode: parsed.data.promoCode,
      paymentMethod,
      env: process.env,
      returnUrlFor: (orderId) => absoluteUrl(`/checkout/return?orderId=${encodeURIComponent(orderId)}`),
    });

    if (paymentMethod === "bank_transfer" || !placed.session) {
      const bank = bankTransferDetails(process.env);
      return NextResponse.json({
        orderId: placed.orderId,
        amountCents: placed.totalCents,
        currency: "aud",
        paymentMethod: "bank_transfer",
        reference: placed.orderId,
        ...bank,
      });
    }

    return NextResponse.json({
      orderId: placed.orderId,
      sessionId: placed.session.sessionId,
      planId: placed.session.planId,
      environment: placed.session.environment,
      amountCents: placed.totalCents,
      currency: "aud",
      returnUrl: absoluteUrl(`/checkout/return?orderId=${encodeURIComponent(placed.orderId)}`),
    });
  } catch (error) {
    if (error instanceof OrdersUnavailableError) {
      return NextResponse.json(
        { error: "Orders are not configured. Add DATABASE_URL." },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "Checkout failed";
    const status = /Cart is empty|quantity|valid option|no longer|nothing to charge|greater than zero/.test(
      message,
    )
      ? 400
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
