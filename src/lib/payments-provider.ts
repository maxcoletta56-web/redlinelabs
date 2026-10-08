export const PAYMENTS_PROVIDERS = ["bank_transfer", "paypal"] as const;

export type PaymentsProvider = (typeof PAYMENTS_PROVIDERS)[number];

export const DEFAULT_PAYMENTS_PROVIDER: PaymentsProvider = "bank_transfer";

/** Buyer-facing rails. PayID stays the default. PayPal is an extra choice. */
export const CHECKOUT_PAYMENT_METHODS = ["bank_transfer", "whop", "paypal"] as const;

export type CheckoutPaymentMethod = (typeof CHECKOUT_PAYMENT_METHODS)[number];

export const CHECKOUT_METHOD_LABELS: Record<CheckoutPaymentMethod, string> = {
  bank_transfer: "Pay by PayID / bank transfer",
  whop: "Pay by card",
  paypal: "Pay with PayPal or card",
};

/**
 * Hides the PayPal choice without turning off bank transfer. Unset or unknown
 * values keep today's default rail, so an existing `bank_transfer` or `paypal`
 * env still allows PayPal when credentials are present.
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
 * `bank_transfer_only` is the kill switch; anything else still parses as
 * `bank_transfer` or `paypal` so older env values keep working.
 *
 * Read through `process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER` directly so the
 * value is inlined into the client bundle at build time.
 */
export function paymentsProvider(): PaymentsProvider {
  return parsePaymentsProvider(process.env.NEXT_PUBLIC_PAYMENTS_PROVIDER);
}

/** True when PayPal credentials exist and the kill switch is off. */
export function paypalCheckoutOffered(
  envValue: string | null | undefined,
  paypalConfigured: boolean,
) {
  if (!paypalConfigured) return false;
  return (envValue?.trim().toLowerCase() ?? "") !== BANK_TRANSFER_ONLY;
}

export function whopCheckoutOffered(envValue: string | null | undefined, whopConfigured: boolean) {
  if (!whopConfigured) return false;
  return (envValue?.trim().toLowerCase() ?? "") !== BANK_TRANSFER_ONLY;
}

export function checkoutPaymentChoices(input: {
  envValue?: string | null;
  paypalConfigured: boolean;
  bankTransferConfigured?: boolean;
  whopConfigured?: boolean;
}) {
  const paypalOffered = paypalCheckoutOffered(input.envValue, input.paypalConfigured);
  const whopOffered = whopCheckoutOffered(input.envValue, Boolean(input.whopConfigured));
  const bankReady = input.bankTransferConfigured !== false;
  const methods: CheckoutPaymentMethod[] = [];
  if (bankReady) methods.push("bank_transfer");
  if (whopOffered) methods.push("whop");
  if (paypalOffered) methods.push("paypal");
  if (methods.length === 0) {
    return {
      paypalOffered: false,
      whopOffered: false,
      methods: ["bank_transfer"] as CheckoutPaymentMethod[],
      defaultMethod: "bank_transfer" as CheckoutPaymentMethod,
      showChoice: false,
    };
  }
  return {
    paypalOffered,
    whopOffered,
    methods,
    defaultMethod: methods[0] ?? "bank_transfer",
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
 * What checkout should render. Both rails are a choice when each can run.
 * A legacy `paypal` env with no PayID config stays PayPal-only, including the
 * not-configured state. Otherwise a missing PayPal config leaves the PayID page
 * unchanged.
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
  if (choices.defaultMethod === "paypal" || choices.defaultMethod === "whop") {
    return { ...choices, setup: null };
  }
  return {
    ...choices,
    setup: input.bankTransferConfigured ? null : "bank_transfer",
  };
}

/**
 * An omitted method follows the legacy env rail so older API clients that
 * never send `paymentMethod` keep working. An explicit PayPal request is
 * refused when the choice is hidden.
 */
export function resolveRequestedPaymentMethod(input: {
  requested?: string | null;
  envValue?: string | null;
  paypalOffered: boolean;
  whopOffered?: boolean;
}): CheckoutPaymentMethod | "unavailable" {
  const requested = input.requested?.trim().toLowerCase() ?? "";
  if (requested === "whop" || requested === "card") {
    return input.whopOffered ? "whop" : "unavailable";
  }
  if (requested === "paypal") return input.paypalOffered ? "paypal" : "unavailable";
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
