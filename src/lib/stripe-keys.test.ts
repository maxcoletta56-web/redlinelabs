import assert from "node:assert/strict";
import test from "node:test";
import { resolveStripeKeys } from "./stripe-keys.ts";

const liveSecret = "sk_live_aaaaaaaa";
const livePublishable = "pk_live_bbbbbbbb";
const testSecret = "sk_test_cccccccc";
const testPublishable = "pk_test_dddddddd";

test("prefers live keys when both live and test are present", () => {
  const resolved = resolveStripeKeys({
    STRIPE_SECRET_KEY: testSecret,
    REDLINE_STRIPE_SECRET_KEY: liveSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: testPublishable,
    NEXT_PUBLIC_REDLINE_STRIPE_PUBLISHABLE_KEY: livePublishable,
  });

  assert.deepEqual(resolved, {
    secret: liveSecret,
    publishable: livePublishable,
    mode: "live",
  });
});

test("ignores test keys on Vercel production", () => {
  const resolved = resolveStripeKeys({
    VERCEL_ENV: "production",
    STRIPE_SECRET_KEY: testSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: testPublishable,
  });

  assert.equal(resolved, undefined);
});

test("uses live keys on Vercel production even if a test key is listed first", () => {
  const resolved = resolveStripeKeys({
    VERCEL_ENV: "production",
    STRIPE_SECRET_KEY: testSecret,
    OTHER_SECRET: liveSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: testPublishable,
    OTHER_PUBLISHABLE: livePublishable,
  });

  assert.deepEqual(resolved, {
    secret: liveSecret,
    publishable: livePublishable,
    mode: "live",
  });
});

test("allows test keys on preview", () => {
  const resolved = resolveStripeKeys({
    VERCEL_ENV: "preview",
    STRIPE_SECRET_KEY: testSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: testPublishable,
  });

  assert.deepEqual(resolved, {
    secret: testSecret,
    publishable: testPublishable,
    mode: "test",
  });
});

test("rejects a live/test key mismatch", () => {
  const resolved = resolveStripeKeys({
    STRIPE_SECRET_KEY: liveSecret,
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: testPublishable,
  });

  assert.equal(resolved, undefined);
});

test("ignores Stripe key IDs", () => {
  const resolved = resolveStripeKeys({
    STRIPE_SECRET_KEY: "mk_1UEtX9CFWWV1oq9LBiuPBGsR",
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: livePublishable,
    FALLBACK_SECRET: liveSecret,
  });

  assert.deepEqual(resolved, {
    secret: liveSecret,
    publishable: livePublishable,
    mode: "live",
  });
});
