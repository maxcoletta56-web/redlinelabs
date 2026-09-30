import { NextResponse } from "next/server";
import { handleWhopWebhook } from "@/lib/whop-webhook";
import { unwrapWhopWebhook, WhopWebhookError } from "@/lib/whop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const payload = await request.text();
  let event: unknown;
  try {
    event = unwrapWhopWebhook(payload, request.headers, process.env.WHOP_WEBHOOK_SECRET);
  } catch (error) {
    console.error("[whop] webhook signature rejected", {
      errorName: error instanceof WhopWebhookError ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  try {
    await handleWhopWebhook(event);
  } catch (error) {
    console.error("[whop] webhook failed", {
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: error instanceof Error ? error.message.slice(0, 200) : "unknown",
    });
    return NextResponse.json({ error: "Webhook could not be processed" }, { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
