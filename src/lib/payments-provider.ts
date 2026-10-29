export const PAYMENTS_PROVIDERS = ["bank_transfer", "paypal"] as const;

export type PaymentsProvider = (typeof PAYMENTS_PROVIDERS)[number];

export const DEFAULT_PAYMENTS_PROVIDER: PaymentsProvider = "bank_transfer";

/** Buyer-facing rails. PayID stays the default. Card (Whop) is the extra choice. PayPal stays hidden unless the public flag asks for it. */
export const CHECKOUT_PAYMENT_METHODS = ["bank_transfer", "whop", "paypal"] as const;

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export const CHECKOUT_METHOD_LABELS: Record<CheckoutPaymentMethod, string> = {
  bank_transfer: "Pay by PayID / bank transfer",
  whop: "Pay by card",
  paypal: "Pay with PayPal or card",
};

/**
 * Kept so an older `bank_transfer_only` flag still parses as PayID-only.
 * PayPal is hidden for that value, and for every value other than `paypal`.
 */
export const BANK_TRANSFER_ONLY = "bank_transfer_only";

export function parsePaymentsProvider(value: string | null | undefined): PaymentsProvider {
  const requested = value?.trim().toLowerCase() ?? "";
  return (PAYMENTS_PROVIDERS as readonly string[]).includes(requested)
    ? (requested as PaymentsProvider)
    : DEFAULT_PAYMENTS_PROVIDER;
}

/**
 * Legacy single-rail value. Checkout no longer uses this to hide PayID.
 * `paypal` is the only value that offers PayPal. `bank_transfer`,
 * `bank_transfer_only`, and an unset flag stay on PayID. Whop card checkout
 * is separate: it is offered when `WHOP_API_KEY` is set.
 *
 * Read through `process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER` directly so the
 * value is inlined into the client bundle at build time.
 */
export function paymentsProvider(): PaymentsProvider {
  return parsePaymentsProvider(process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER);
}

/** True only when credentials exist and the public flag explicitly asks for PayPal. */
export function paypalCheckoutOffered(
  envValue: string | null | undefined,
  paypalConfigured: boolean,
) {
  if (!paypalConfigured) return false;
  const flag = envValue?.trim().toLowerCase() ?? "";
  if (flag === BANK_TRANSFER_ONLY) return false;
  return flag === "paypal";
}

export function checkoutPaymentChoices(input: {
  envValue?: string | null;
  paypalConfigured: boolean;
  bankTransferConfigured?: boolean;
  whopConfigured?: boolean;
}) {
  const paypalOffered = paypalCheckoutOffered(input.envValue, input.paypalConfigured);
  const bankReady = input.bankTransferConfigured !== false;
  const whopOffered = input.whopConfigured === true;
  const methods: CheckoutPaymentMethod[] = [];
  if (bankReady) methods.push("bank_transfer");
  if (whopOffered) methods.push("whop");
  if (paypalOffered) methods.push("paypal");
  if (methods.length === 0) {
    return {
      paypalOffered: false,
      whopOffered: false,
      methods: ["bank_transfer"] as CheckoutPaymentMethod[],
      defaultMethod: "bank_transfer" as const,
      showChoice: false,
    };
  }
  const defaultMethod = methods.includes("bank_transfer")
    ? ("bank_transfer" as const)
    : methods[0]!;
  return {
    paypalOffered,
    whopOffered,
    methods,
    defaultMethod,
    showChoice: methods.length > 1,
  };
}

export type CheckoutSurface = {
  paypalOffered: boolean;
  whopOffered: boolean;
  methods: readonly CheckoutPaymentMethod[];
  defaultMethod: CheckoutPaymentMethod;
  showChoice: boolean;
  /** Which setup message to show when that rail cannot run. */
  setup: CheckoutPaymentMethod | null;
};

/**
 * What checkout should render. PayID is the page customers see. Card checkout
 * sits beside it when Whop is configured. PayPal is a further choice only when
 * the public flag is `paypal` and that rail can run. That same flag with no
 * PayID config and no Whop key stays PayPal-only, including the not-configured
 * state.
 */
export function checkoutSurface(input: {
  envValue?: string | null;
  paypalConfigured: boolean;
  bankTransferConfigured: boolean;
  whopConfigured?: boolean;
}): CheckoutSurface {
  const choices = checkoutPaymentChoices(input);
  const provider = parsePaymentsProvider(input.envValue);
  if (choices.showChoice) return { ...choices, setup: null };
  if (choices.whopOffered && choices.defaultMethod === "whop") {
    return { ...choices, setup: null };
  }
  if (provider === "paypal" && !input.bankTransferConfigured && !input.whopConfigured) {
    return {
      paypalOffered: false,
      whopOffered: false,
      methods: ["paypal"],
      defaultMethod: "paypal",
      showChoice: false,
      setup: input.paypalConfigured ? null : "paypal",
    };
  }
  if (choices.defaultMethod === "paypal") return { ...choices, setup: null };
  return {
    ...choices,
    setup: input.bankTransferConfigured ? null : "bank_transfer",
  };
}

/**
 * An omitted method follows the legacy env rail so older API clients that
 * never send `paymentMethod` keep working. An explicit PayPal or card request
 * is refused when that choice is hidden.
 */
export function resolveRequestedPaymentMethod(input: {
  requested?: string | null;
  envValue?: string | null;
  paypalOffered: boolean;
  whopOffered?: boolean;
}): CheckoutPaymentMethod | "unavailable" {
  const requested = input.requested?.trim().toLowerCase() ?? "";
  if (requested === "paypal") return input.paypalOffered ? "paypal" : "unavailable";
  if (requested === "whop") return input.whopOffered ? "whop" : "unavailable";
  if (requested === "bank_transfer") return "bank_transfer";
  if (requested) return "unavailable";
  if (parsePaymentsProvider(input.envValue) === "paypal") {
    return input.paypalOffered ? "paypal" : "unavailable";
  }
  return "bank_transfer";
}

/** Short label for an order row. Older rows with no column read as PayID. */
export function paymentMethodLabel(method: string | null | undefined) {
  if (method === "paypal") return "PayPal or card";
  if (method === "whop") return "Card";
  return "PayID / bank transfer";
}
