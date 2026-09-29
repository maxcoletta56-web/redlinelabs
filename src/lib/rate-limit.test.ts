import assert from "node:assert/strict";
import test from "node:test";
import { peekRateLimit, rateLimit, resetRateLimitForTests } from "./rate-limit.ts";

const windowMs = 15 * 60 * 1000;
const start = 1_700_000_000_000;

test("eight failures fill the window and later peeks do not add another hit", () => {
  resetRateLimitForTests();
  const key = "admin-login:203.0.113.8";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.equal(rateLimit(key, 8, windowMs, start + attempt).ok, true);
  }
  assert.equal(peekRateLimit(key, 8, windowMs, start + 8).ok, false);
  assert.equal(peekRateLimit(key, 8, windowMs, start + 9).ok, false);
  assert.equal(rateLimit(key, 8, windowMs, start + 10).ok, false);
});

test("checking the window does not use up an attempt", () => {
  resetRateLimitForTests();
  const key = "admin-login:203.0.113.9";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    assert.equal(peekRateLimit(key, 8, windowMs, start).ok, true);
  }
  assert.equal(rateLimit(key, 8, windowMs, start).ok, true);
  assert.equal(peekRateLimit(key, 8, windowMs, start).ok, true);
});

test("attempts older than the window are forgotten", () => {
  resetRateLimitForTests();
  const key = "admin-login:203.0.113.10";
  for (let attempt = 0; attempt < 8; attempt += 1) {
    rateLimit(key, 8, windowMs, start);
  }
  assert.equal(peekRateLimit(key, 8, windowMs, start + windowMs).ok, true);
  assert.equal(rateLimit(key, 8, windowMs, start + windowMs).ok, true);
});
