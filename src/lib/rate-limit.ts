type Bucket = {
  hits: number[];
};

const buckets = new Map<string, Bucket>();

export function resetRateLimitForTests() {
  buckets.clear();
}

function bucketInWindow(key: string, windowMs: number, now: number) {
  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((time) => now - time < windowMs);
  buckets.set(key, bucket);
  return bucket;
}

/** Reads the window without recording an attempt. */
export function peekRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = bucketInWindow(key, windowMs, now);
  if (bucket.hits.length >= limit) {
    const retryAfterMs = windowMs - (now - bucket.hits[0]);
    return { ok: false, retryAfterMs };
  }
  return { ok: true, retryAfterMs: 0 };
}

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const bucket = bucketInWindow(key, windowMs, now);
  if (bucket.hits.length >= limit) {
    const retryAfterMs = windowMs - (now - bucket.hits[0]);
    return { ok: false, retryAfterMs };
  }
  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfterMs: 0 };
}

export function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
