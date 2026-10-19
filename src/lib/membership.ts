/**
 * Redline membership, shaped like a monthly member-price plan:
 * one price per month, 30% off a set of products that changes on the 1st,
 * applied automatically at checkout. No database and no server-only imports.
 */

export const MEMBERSHIP_PRICE_CENTS = 5_000;

export const MEMBER_DISCOUNT_PERCENT = 30;

/** Catalogue slug used only for the monthly fee. It is not a shop product. */
export const MEMBERSHIP_SLUG = "redline-membership";

/**
 * Twelve research products. Each calendar month in Sydney publishes six,
 * then the window moves on the 1st.
 */
export const SPECIAL_POOL = [
  "glow",
  "slu-pp-332",
  "nad-plus",
  "melanotan-2",
  "cjc-1295",
  "kpv",
  "klow",
  "igf-1",
  "mots-c",
  "tesamorelin",
  "tb-500",
  "retatrutide",
] as const;

const OFFERS_PER_MONTH = 6;

export type SydneyDate = { year: number; month: number; day: number };

export function sydneyDate(date: Date): SydneyDate {
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: pick("year"), month: pick("month"), day: pick("day") };
}

export function monthSpecials(date: Date): string[] {
  const { year, month } = sydneyDate(date);
  const start = (year * 12 + (month - 1)) % SPECIAL_POOL.length;
  return Array.from({ length: OFFERS_PER_MONTH }, (_, offset) => {
    return SPECIAL_POOL[(start + offset) % SPECIAL_POOL.length];
  });
}

export function isMemberSpecial(slug: string, date: Date) {
  return monthSpecials(date).includes(slug);
}

/** Whole cents, rounded once. $164.99 at 30% off is $115.49. */
export function memberUnitCents(unitCents: number) {
  const unit = Math.max(0, Math.floor(unitCents || 0));
  return Math.round((unit * (100 - MEMBER_DISCOUNT_PERCENT)) / 100);
}

/** Days from the Sydney calendar date until the 1st, when the list changes. */
export function daysUntilNextOffers(date: Date) {
  const { year, month, day } = sydneyDate(date);
  const today = Date.UTC(year, month - 1, day);
  const next = Date.UTC(year, month, 1);
  return Math.max(0, Math.round((next - today) / 86_400_000));
}

export function offerMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function membershipIsActive(
  until: string | null | undefined,
  now = new Date(),
) {
  if (!until) return false;
  const ends = new Date(until).getTime();
  return Number.isFinite(ends) && ends > now.getTime();
}
