import { NextResponse } from "next/server";
import { handleWhopWebhookEvent } from "@/lib/whop-webhook";
import { parseWhopWebhookEvent, resolveWhop, verifyWhopWebhook } from "@/lib/whop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function header(request: Request, name: string) {
  return request.headers.get(name);
}

export async function POST(request: Request) {
  const config = resolveWhop(process.env);
  if (!config?.webhookSecret) {
    console.error("[whop] WHOP_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook is not configured" }, { status: 500 });
  }

  const body = await request.text();
  const verified = verifyWhopWebhook({
    secret: config.webhookSecret,
    body,
    id: header(request, "webhook-id"),
    timestamp: header(request, "webhook-timestamp"),
    signature: header(request, "webhook-signature"),
  });
  if (!verified) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = parseWhopWebhookEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid webhook payload" }, { status: 400 });
  }

  try {
    const outcome = await handleWhopWebhookEvent(event);
    return NextResponse.json({ ok: outcome.ok, action: outcome.action }, { status: outcome.status });
  } catch (error) {
    console.error("[whop] webhook handler failed", {
      type: event.type,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
