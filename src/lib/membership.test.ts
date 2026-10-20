import assert from "node:assert/strict";
import test from "node:test";
import { MEMBERSHIP_PRICE_CENTS, membershipIsActive } from "./membership.ts";

test("club sign-up is a one-time $15 fee", () => {
  assert.equal(MEMBERSHIP_PRICE_CENTS, 1_500);
});

test("a membership stays active for a far-future sign-up and not after it ends", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  assert.equal(membershipIsActive("9999-12-31T00:00:00.000Z", now), true);
  assert.equal(membershipIsActive("2026-11-19T00:00:00.000Z", now), true);
  assert.equal(membershipIsActive("2026-10-19T00:00:00.000Z", now), false);
  assert.equal(membershipIsActive(null, now), false);
});
