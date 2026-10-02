import { sendPaymentReceivedEmail } from "@/lib/mailer";
import { scheduleEmail } from "@/lib/schedule-email";
import { settleWhopWebhook } from "@/lib/whop-payments";
import { WhopWebhookError, verifyAndReadWhopWebhook } from "@/lib/whop-webhook";

export async function POST(request: Request) {
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim() ?? "";
  if (!secret) {
    return new Response("Webhook is not configured", { status: 503 });
  }

  const rawBody = await request.text();
  let event;
  try {
    event = verifyAndReadWhopWebhook(rawBody, request.headers, secret);
  } catch (error) {
    console.error("[whop] webhook rejected", {
      errorName: error instanceof Error ? error.name : "unknown",
      rejected: error instanceof WhopWebhookError,
    });
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    const result = await settleWhopWebhook(event);
    if (result.email) {
      const notice = result.email;
      scheduleEmail(notice.reference, () => sendPaymentReceivedEmail(notice));
    }
  } catch (error) {
    console.error("[whop] webhook failed", {
      type: event.type,
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return new Response("Retry", { status: 500 });
  }

  return new Response("OK", { status: 200 });
}
