import { createHmac, timingSafeEqual } from "node:crypto";

/** Matches the tolerance `standardwebhooks` uses inside `@whop/sdk` `unwrapWebhook`. */
const TOLERANCE_SECONDS = 5 * 60;

export class WhopSignatureError extends Error {
  readonly code: "missing_key" | "invalid";

  constructor(code: "missing_key" | "invalid", message: string) {
    super(message);
    this.name = "WhopSignatureError";
    this.code = code;
  }
}

function headerMap(headers: Headers | Record<string, string | string[] | undefined>) {
  const map = new Map<string, string>();
  if (headers instanceof Headers) {
    headers.forEach((value, name) => {
      map.set(name.toLowerCase(), value);
    });
    return map;
  }
  for (const [name, value] of Object.entries(headers)) {
    if (typeof value === "string") map.set(name.toLowerCase(), value);
    else if (Array.isArray(value) && value.length > 0) map.set(name.toLowerCase(), value.join(", "));
  }
  return map;
}

function signaturesMatch(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/**
 * Verifies a Whop webhook the way `@whop/sdk/helpers` `unwrapWebhook` does.
 * Whop HMACs the raw `ws_` secret over `id.timestamp.body`. The body must be
 * the exact request bytes (`request.text()`), not a re-serialized object.
 */
export function verifyWhopWebhook(
  payload: string,
  headers: Headers | Record<string, string | string[] | undefined>,
  key: string | undefined,
  nowSeconds = Math.floor(Date.now() / 1000),
): unknown {
  const secret = key?.trim() ?? "";
  if (!secret) {
    throw new WhopSignatureError(
      "missing_key",
      "Cannot verify a webhook without a key. Pass the endpoint's signing secret as key.",
    );
  }

  const normalized = headerMap(headers);
  const id = normalized.get("webhook-id") ?? "";
  const timestamp = normalized.get("webhook-timestamp") ?? "";
  const signature = normalized.get("webhook-signature") ?? "";
  const issuedAt = Number(timestamp);
  if (!id || !timestamp || !signature || !Number.isFinite(issuedAt)) {
    throw new WhopSignatureError("invalid", "Missing webhook signature headers");
  }
  if (Math.abs(nowSeconds - issuedAt) > TOLERANCE_SECONDS) {
    throw new WhopSignatureError("invalid", "Webhook timestamp is outside the tolerance window");
  }

  const expected = createHmac("sha256", secret).update(`${id}.${timestamp}.${payload}`).digest("base64");
  const matched = signature.split(" ").some((part) => {
    if (!part.startsWith("v1,")) return false;
    return signaturesMatch(part.slice(3), expected);
  });
  if (!matched) {
    throw new WhopSignatureError("invalid", "Webhook signature does not match");
  }

  try {
    return JSON.parse(payload) as unknown;
  } catch {
    throw new WhopSignatureError("invalid", "Webhook body is not JSON");
  }
}
