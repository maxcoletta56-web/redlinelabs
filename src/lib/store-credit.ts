export const STRIPE_MIN_CHARGE_CENTS = 50;

export function dollarsToCents(amount: number) {
  return Math.round(amount * 100);
}

export function centsToDollars(cents: number) {
  return cents / 100;
}

/**
 * Browser profiles are not a ledger. Checkout must ignore any store-credit
 * amount supplied by the client until credit is loaded from server records.
 */
export function serverStoreCreditCents() {
  return 0;
}

/** Largest store-credit amount that can be applied without a $0 Stripe charge. */
export function creditToApplyCents(balanceCents: number, subtotalCents: number) {
  const balance = Math.max(0, Math.floor(balanceCents));
  const subtotal = Math.max(0, Math.floor(subtotalCents));
  if (balance <= 0 || subtotal <= 0) return 0;
  if (subtotal <= STRIPE_MIN_CHARGE_CENTS) return 0;
  return Math.min(balance, subtotal - STRIPE_MIN_CHARGE_CENTS);
}
