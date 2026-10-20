/**
 * Redline Club sign-up. One fee, paid once through the normal checkout.
 * Spend after that earns points and moves the tier. No catalogue discount.
 */

export const MEMBERSHIP_PRICE_CENTS = 1_500;

/** Catalogue slug used only for the sign-up fee. It is not a shop product. */
export const MEMBERSHIP_SLUG = "redline-membership";

export function membershipIsActive(
  until: string | null | undefined,
  now = new Date(),
) {
  if (!until) return false;
  const ends = new Date(until).getTime();
  return Number.isFinite(ends) && ends > now.getTime();
}
