import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

function headerValue(headers: Headers | Record<string, string | undefined>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? headers.get(name.toLowerCase());
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return undefined;
}

function signaturesMatch(presented: string, expected: string) {
  const left = Buffer.from(presented);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Verify a Whop Standard Webhooks delivery. The secret is the `ws_` value, used as the HMAC key. */
export function verifyWhopWebhook(
  payload: string,
  headers: Headers | Record<string, string | undefined>,
  secret: string,
  now = Date.now(),
) {
  if (!secret) {
    throw new Error("Cannot verify a webhook without a key. Pass the endpoint's signing secret as key.");
  }
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new Error("Missing webhook signature");
  }
  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds) || Math.abs(now / 1000 - seconds) > TOLERANCE_SECONDS) {
    throw new Error("Webhook timestamp is outside the tolerance window");
  }
  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const valid = signature.split(" ").some((part) => {
    const comma = part.indexOf(",");
    if (comma === -1) return false;
    const version = part.slice(0, comma);
    const value = part.slice(comma + 1);
    return version === "v1" && signaturesMatch(value, expected);
  });
  if (!valid) throw new Error("Invalid webhook signature");
  return JSON.parse(payload) as unknown;
}
