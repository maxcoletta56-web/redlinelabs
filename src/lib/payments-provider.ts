export const PAYMENTS_PROVIDERS = ["bank_transfer", "paypal"] as const;

export type PaymentsProvider = (typeof PAYMENTS_PROVIDERS)[number];

export const DEFAULT_PAYMENTS_PROVIDER: PaymentsProvider = "bank_transfer";

export function parsePaymentsProvider(value: string | null | undefined): PaymentsProvider {
  const requested = value?.trim().toLowerCase() ?? "";
  return (PAYMENTS_PROVIDERS as readonly string[]).includes(requested)
    ? (requested as PaymentsProvider)
    : DEFAULT_PAYMENTS_PROVIDER;
}

/**
 * Legacy single-rail switch. Checkout now offers Whop card checkout and bank
 * transfer together, so this value no longer hides one of them. `paypal` is
 * not a provider and falls back to bank transfer. A `stripe` value is not a
 * provider either.
 *
 * Read through `process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER` directly so the
 * value is inlined into the client bundle at build time.
 */
export function paymentsProvider(): PaymentsProvider {
  return parsePaymentsProvider(process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER);
}
