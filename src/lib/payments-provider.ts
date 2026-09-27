export const PAYMENTS_PROVIDERS = ["bank_transfer", "stripe"] as const;

export type PaymentsProvider = (typeof PAYMENTS_PROVIDERS)[number];

export const DEFAULT_PAYMENTS_PROVIDER: PaymentsProvider = "bank_transfer";

export function parsePaymentsProvider(value: string | null | undefined): PaymentsProvider {
  const requested = value?.trim().toLowerCase() ?? "";
  return (PAYMENTS_PROVIDERS as readonly string[]).includes(requested)
    ? (requested as PaymentsProvider)
    : DEFAULT_PAYMENTS_PROVIDER;
}

/**
 * The selected rail. `bank_transfer` takes a manual Australian transfer or
 * PayID and settles it out of band. `stripe` selects the hosted card rail,
 * which on this branch is the Payoneer list checkout in checkout-session.ts
 * plus the key helpers in stripe-keys.ts; both stay in place so a card
 * processor can be re-enabled by changing this one variable.
 *
 * Read through `process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER` directly so the
 * value is inlined into the client bundle at build time and the browser and
 * the server always agree on one provider.
 */
export function paymentsProvider(): PaymentsProvider {
  return parsePaymentsProvider(process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER);
}
