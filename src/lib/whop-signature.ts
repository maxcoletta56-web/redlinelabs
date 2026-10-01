import { createHmac, timingSafeEqual } from "node:crypto";

const TOLERANCE_SECONDS = 5 * 60;

export class WhopSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopSignatureError";
  }
}

/**
 * Whop signs with the literal UTF-8 bytes of the `ws_` secret. `standardwebhooks`
 * base64-decodes its key first, so the SDK base64-encodes the secret before
 * handing it over. The HMAC key here is those same raw bytes.
 */
export function whopWebhookHmacKey(secret: string) {
  const trimmed = secret.trim();
  if (!trimmed) throw new WhopSignatureError("Webhook secret is empty");
  return Buffer.from(trimmed, "utf8");
}

function headerValue(headers: Headers | Record<string, string | undefined>, name: string) {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? "";
  }
  const record = headers as Record<string, string | undefined>;
  return record[name] ?? record[name.toLowerCase()] ?? "";
}

/**
 * Verifies the raw body against `webhook-id`, `webhook-timestamp`, and
 * `webhook-signature`. Returns the parsed JSON only after the signature matches.
 */
export function verifyWhopWebhook(
  payload: string,
  headers: Headers | Record<string, string | undefined>,
  secret: string,
  nowMs = Date.now(),
): unknown {
  const id = headerValue(headers, "webhook-id");
  const timestamp = headerValue(headers, "webhook-timestamp");
  const signature = headerValue(headers, "webhook-signature");
  if (!id || !timestamp || !signature) {
    throw new WhopSignatureError("Missing webhook signature headers");
  }

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) throw new WhopSignatureError("Invalid webhook timestamp");
  if (Math.abs(nowMs / 1000 - seconds) > TOLERANCE_SECONDS) {
    throw new WhopSignatureError("Webhook timestamp is outside the tolerance window");
  }

  const expected = createHmac("sha256", whopWebhookHmacKey(secret))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const match = signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const actual = Buffer.from(value);
    return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
  });
  if (!match) throw new WhopSignatureError("Webhook signature does not match");

  return JSON.parse(payload) as unknown;
}

export function signWhopWebhook(payload: string, secret: string, id: string, timestamp: number) {
  const signature = createHmac("sha256", whopWebhookHmacKey(secret))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${signature}`;
}
