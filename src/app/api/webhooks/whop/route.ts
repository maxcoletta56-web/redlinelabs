import { NextResponse } from "next/server";
import { applyWhopPayment, getOrderStore } from "@/lib/orders";
import { readWhopPaymentNotice } from "@/lib/whop-events";
import { verifyWhopWebhook } from "@/lib/whop-signature";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const payload = await request.text();
  let body: unknown;
  try {
    body = verifyWhopWebhook(payload, request.headers, process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const notice = readWhopPaymentNotice(body);
  if (!notice) return new Response("OK", { status: 200 });

  try {
    await applyWhopPayment(getOrderStore(), notice);
  } catch {
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return new Response("OK", { status: 200 });
}
