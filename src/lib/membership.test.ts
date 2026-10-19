import assert from "node:assert/strict";
import test from "node:test";
import {
  MEMBER_DISCOUNT_PERCENT,
  MEMBERSHIP_PRICE_CENTS,
  daysUntilNextOffers,
  isMemberSpecial,
  memberUnitCents,
  membershipIsActive,
  monthSpecials,
  offerMonthLabel,
} from "./membership.ts";

test("membership is $50 a month and member prices are 30% off", () => {
  assert.equal(MEMBERSHIP_PRICE_CENTS, 5_000);
  assert.equal(MEMBER_DISCOUNT_PERCENT, 30);
  assert.equal(memberUnitCents(16_499), 11_549);
  assert.equal(memberUnitCents(11_000), 7_700);
  assert.equal(memberUnitCents(9_999), 6_999);
  assert.equal(memberUnitCents(8_499), 5_949);
});

test("October 2026 publishes six specials and counts down to the 1st", () => {
  const october = new Date("2026-10-19T00:00:00.000Z");
  const specials = monthSpecials(october);
  assert.equal(specials.length, 6);
  assert.equal(new Set(specials).size, 6);
  assert.equal(isMemberSpecial("glow", october), true);
  assert.equal(isMemberSpecial("bpc-157", october), false);
  assert.equal(daysUntilNextOffers(october), 13);
  assert.equal(offerMonthLabel(october), "October 2026");
});

test("the specials list moves on the first of the next month", () => {
  const october = monthSpecials(new Date("2026-10-19T00:00:00.000Z"));
  const november = monthSpecials(new Date("2026-11-15T00:00:00.000Z"));
  assert.notDeepEqual(october, november);
  assert.equal(daysUntilNextOffers(new Date("2026-11-01T00:00:00.000Z")), 30);
});

test("a membership is active until the stored instant and not after", () => {
  const now = new Date("2026-10-19T00:00:00.000Z");
  assert.equal(membershipIsActive("2026-11-19T00:00:00.000Z", now), true);
  assert.equal(membershipIsActive("2026-10-19T00:00:00.000Z", now), false);
  assert.equal(membershipIsActive(null, now), false);
});
