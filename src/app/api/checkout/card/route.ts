import { NextResponse } from "next/server";
import { checkoutOrigin, createWhopCardCheckout } from "@/lib/whop-checkout";
import { ordersConfigured } from "@/lib/orders";
import { whopConfigured } from "@/lib/whop";
import { checkoutBodySchema } from "@/lib/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SETUP =
  "Card checkout is not configured. Add WHOP_API_KEY, WHOP_WEBHOOK_SECRET, WHOP_COMPANY_ID, and DATABASE_URL.";

export async function POST(request: Request) {
  if (!whopConfigured() || !ordersConfigured()) {
    return NextResponse.json({ error: SETUP }, { status: 503 });
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
    const session = await createWhopCardCheckout(
      {
        items: parsed.data.items,
        email: parsed.data.email,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        shipping: parsed.data.shipping,
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      },
      { origin: checkoutOrigin(request) },
    );
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout failed";
    const status =
      message.includes("Cart is empty") ||
      message.includes("quantity") ||
      message.includes("shipping address") ||
      message.includes("greater than zero") ||
      message.includes("catalogue") ||
      message.includes("option")
        ? 400
        : 502;
    return NextResponse.json(
      {
        error:
          status === 400
            ? message
            : "The card processor did not start checkout. Nothing has been charged.",
      },
      { status },
    );
  }
}
