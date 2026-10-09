import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verifies a Whop webhook the way `@whop/sdk` `unwrapWebhook` does.
 *
 * Whop signs with the Standard Webhooks scheme and the raw UTF-8 bytes of the
 * endpoint secret (the `ws_` prefix included). The signed content is
 * `webhook-id.webhook-timestamp.rawBody`. The signature header is one or more
 * space-separated `v1,<base64 hmac-sha256>` values. The timestamp must be
 * within five minutes.
 */

const TOLERANCE_SECONDS = 5 * 60;

export class WhopSignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WhopSignatureError";
  }
}

function header(headers: Headers | Record<string, string | null | undefined>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? headers.get(name.toLowerCase());
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return value ?? null;
  }
  return null;
}

function signaturesMatch(expected: string, presented: string) {
  const left = Buffer.from(expected);
  const right = Buffer.from(presented);
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

export function unwrapWhopWebhook(
  payload: string,
  headers: Headers | Record<string, string | null | undefined>,
  secret: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): unknown {
  const key = secret?.trim() ?? "";
  if (!key) throw new WhopSignatureError("Cannot verify a webhook without a key");
  const id = header(headers, "webhook-id")?.trim() ?? "";
  const timestampHeader = header(headers, "webhook-timestamp")?.trim() ?? "";
  const signatureHeader = header(headers, "webhook-signature")?.trim() ?? "";
  if (!id || !timestampHeader || !signatureHeader) {
    throw new WhopSignatureError("Missing webhook signature headers");
  }
  const timestamp = Number.parseInt(timestampHeader, 10);
  if (!Number.isFinite(timestamp)) throw new WhopSignatureError("Invalid webhook timestamp");
  if (nowSeconds - timestamp > TOLERANCE_SECONDS) throw new WhopSignatureError("Webhook timestamp is too old");
  if (timestamp > nowSeconds + TOLERANCE_SECONDS) throw new WhopSignatureError("Webhook timestamp is too new");

  const expected = createHmac("sha256", Buffer.from(key, "utf8"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  const matched = signatureHeader.split(" ").some((part) => {
    const [version, signature] = part.split(",");
    return version === "v1" && typeof signature === "string" && signaturesMatch(expected, signature);
  });
  if (!matched) throw new WhopSignatureError("Invalid webhook signature");
  return JSON.parse(payload) as unknown;
}

/** Signs a body the same way Whop does, for tests. */
export function signWhopWebhook(payload: string, secret: string, id: string, timestamp: number) {
  const signature = createHmac("sha256", Buffer.from(secret, "utf8"))
    .update(`${id}.${timestamp}.${payload}`)
    .digest("base64");
  return `v1,${signature}`;
}
