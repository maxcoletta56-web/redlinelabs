import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export class WebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

export type WhopWebhookEvent = {
  id?: string;
  type?: string;
  event?: string;
  data?: {
    id?: string;
    metadata?: Record<string, unknown> | null;
    checkout_configuration_id?: string | null;
  };
};

function header(headers: Record<string, string>, name: string) {
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return "";
}

/**
 * Verifies a Whop webhook the way `@whop/sdk` `unwrapWebhook` does.
 * Whop HMACs the raw `ws_` secret over `{webhook-id}.{webhook-timestamp}.{body}`.
 * The signature header is Standard Webhooks: `v1,<base64>`.
 */
export function unwrapWebhook(payload: string, headers: Record<string, string>, key: string | undefined): WhopWebhookEvent {
  if (!key?.trim()) {
    throw new Error("Cannot verify a webhook without a key. Pass the endpoint's signing secret as key.");
  }
  const id = header(headers, "webhook-id");
  const timestamp = header(headers, "webhook-timestamp");
  const signature = header(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new WebhookVerificationError("Missing webhook signature headers");
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(Date.now() / 1000 - seconds) > TOLERANCE_SECONDS) {
    throw new WebhookVerificationError("Webhook timestamp is outside the tolerance window");
  }

  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const expectedBytes = Buffer.from(expected);
  const candidates = signature.split(" ").filter((part) => part.startsWith("v1,"));
  const match = candidates.some((part) => {
    const given = Buffer.from(part.slice(3));
    return given.length === expectedBytes.length && timingSafeEqual(given, expectedBytes);
  });
  if (!match) throw new WebhookVerificationError("Webhook signature did not match");

  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    throw new WebhookVerificationError("Webhook body is not JSON");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new WebhookVerificationError("Webhook body is not an object");
  }
  return parsed as WhopWebhookEvent;
}

export function webhookEventName(event: WhopWebhookEvent) {
  return event.type || event.event || "";
}

export function webhookOrderId(event: WhopWebhookEvent) {
  const metadata = event.data?.metadata;
  if (!metadata || typeof metadata !== "object") return "";
  const record = metadata as Record<string, unknown>;
  const value = record.orderId ?? record.order_id;
  return typeof value === "string" ? value : "";
}
