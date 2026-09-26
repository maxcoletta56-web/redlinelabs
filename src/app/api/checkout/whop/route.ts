import { NextResponse } from "next/server";
import { checkoutReturnOrigin, startWhopCardCheckout } from "@/lib/whop-checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { whopConfigured } from "@/lib/whop";
import { checkoutBodySchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readShipping(value: unknown): ShippingAddressInput | null {
  const row = asRecord(value);
  if (!row) return null;
  const name = readString(row.name);
  const line1 = readString(row.line1);
  const city = readString(row.city);
  const state = readString(row.state);
  const postal = readString(row.postal_code);
  if (!name || !line1 || !city || !state || !postal) return null;
  if ([name, line1, city, state, postal].some((part) => part.length > 120)) return null;
  const line2 = readString(row.line2);
  return {
    name,
    line1,
    line2: line2 || undefined,
    city,
    state,
    postal_code: postal,
    country: "AU",
  };
}

export async function POST(request: Request) {
  const limited = rateLimit(`whop-checkout:${clientKey(request)}`, 8, 10 * 60 * 1000);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many checkout attempts. Try again in a few minutes." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(limited.retryAfterMs / 1000)) } },
    );
  }

  if (!whopConfigured()) {
    return NextResponse.json(
      { error: "Whop is not configured. Add WHOP_API_KEY and WHOP_COMPANY_ID." },
      { status: 503 },
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
    const session = await startWhopCardCheckout(
      {
        items: parsed.data.items,
        email: parsed.data.email,
        shipping: readShipping(asRecord(json)?.shipping),
        promoCode: parsed.data.promoCode,
        ageConfirmed: true,
        researchUse: true,
      },
      checkoutReturnOrigin(request),
    );
    return NextResponse.json(session);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Whop checkout failed";
    const status = message.includes("Cart is empty") || message.includes("quantity") || message.includes("total")
      ? 400
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
