import "server-only";

import { isAuState } from "@/lib/account-data";
import { isActiveMember } from "@/lib/club-db";
import {
  MEMBERSHIP_SLUG,
  isMemberSpecial,
  memberUnitCents,
} from "@/lib/membership";
import { resolveBankTransfer } from "@/lib/bank-transfer";
import { getSql, type Sql } from "@/lib/db";
import { sendOrderCreatedEmails, type OrderCreatedNotice } from "@/lib/mailer";
import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "@/lib/order";
import {
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import type { CheckoutPaymentMethod } from "@/lib/payments-provider";
import { lookupPromo, promoDiscountCents } from "@/lib/promo";
import { priceCardOrderCents } from "@/lib/promo-pricing";
import { withTimeout } from "@/lib/with-timeout";

export type BankTransferShippingInput = {
  name?: string | null;
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
};

export type BankTransferOrder = {
  reference: string;
  redirectUrl: string;
  totalCents: number;
};

export type CheckoutOrder = BankTransferOrder & {
  subtotalCents: number;
  promoCode: string | null;
  promoPercentOff: number;
  email: string;
  firstName: string;
  lastName: string;
  items: OrderItemSnapshot[];
  lines: ResolvedLine[];
  shipping: OrderShippingSnapshot;
  paymentMethod: CheckoutPaymentMethod;
};

/** Long enough for a cold Neon compute to wake, short enough to surface a hang. */
const DATABASE_TIMEOUT_MS = 12_000;

const AU_POSTCODE = /^\d{4}$/;

export type ClubRedemptionInput = {
  email: string;
  code: string;
  points: number;
};

export type CreateBankTransferOrderOptions = {
  /** Injected by tests. Production uses DATABASE_URL via getSql(). */
  sql?: Sql | null;
  /** Kept so older checkout callers can still pass a club payload. It is not spent. */
  club?: object;
  membership?: {
    isActive: (email: string) => Promise<boolean>;
    now?: () => Date;
  };
  /** Injected by tests. Production schedules mail and never awaits the send. */
  deliver?: (notice: OrderCreatedNotice) => Promise<void>;
  paymentMethod?: CheckoutPaymentMethod;
  paypalOrderId?: string | null;
  /**
   * PayPal records the order before a card is captured, and does not need
   * PayID details to do that. Bank transfer still requires them. Whop card
   * checkout skips them too: the card form replaces the PayID instructions.
   */
  skipBankConfiguration?: boolean;
  /** Card orders email only after payment.succeeded, not when the row is saved. */
  skipCreatedEmail?: boolean;
};

export type CheckoutOrderInput = {
  items: CartLineInput[];
  email: string;
  firstName?: string;
  lastName?: string;
  shipping?: BankTransferShippingInput | null;
  promoCode?: string | null;
  club?: ClubRedemptionInput | null;
  ageConfirmed: boolean;
  researchUse: boolean;
};

export function bankTransferConfigured() {
  return Boolean(resolveBankTransfer(process.env)) && ordersConfigured();
}

function trimmed(value: string | null | undefined, max: number) {
  return (value ?? "").trim().slice(0, max);
}

/**
 * The address never affects the amount owed, so it is stored as typed after
 * trimming and length capping. Prices always come from the catalogue.
 * A blank line, city, state, or a postcode that is not four digits is rejected.
 */
export function normalizeShipping(
  shipping: BankTransferShippingInput | null | undefined,
): OrderShippingSnapshot | null {
  const line1 = trimmed(shipping?.line1, 200);
  const city = trimmed(shipping?.city, 120);
  const state = trimmed(shipping?.state, 60);
  const postcode = trimmed(shipping?.postal_code, 20);
  if (!line1 || !city || !isAuState(state) || !AU_POSTCODE.test(postcode)) return null;
  return {
    name: trimmed(shipping?.name, 120),
    line1,
    line2: trimmed(shipping?.line2, 200),
    city,
    state,
    postcode,
    country: trimmed(shipping?.country, 2).toUpperCase() || "AU",
  };
}

function databaseFor(options?: CreateBankTransferOrderOptions) {
  if (options && "sql" in options) return options.sql ?? null;
  return getSql();
}

function redactError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message
    .replace(/re_[A-Za-z0-9_-]+/gi, "re_[redacted]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
}

async function deliverOrderNotice(reference: string, notice: OrderCreatedNotice) {
  const { scheduleEmail } = await import("@/lib/schedule-email");
  scheduleEmail(reference, () => sendOrderCreatedEmails(notice));
}

export async function createBankTransferOrder(
  input: CheckoutOrderInput,
  options?: CreateBankTransferOrderOptions,
): Promise<CheckoutOrder> {
  return createCheckoutOrder(input, {
    ...options,
    paymentMethod: "bank_transfer",
    skipBankConfiguration: false,
  });
}

/**
 * Shared insert for PayID and PayPal. Status stays `awaiting_payment` (the
 * unpaid/pending state the rest of the store already uses). Totals, promo,
 * and shipping are calculated once here.
 */
export async function createCheckoutOrder(
  input: CheckoutOrderInput,
  options?: CreateBankTransferOrderOptions,
): Promise<CheckoutOrder> {
  const paymentMethod =
    options?.paymentMethod === "paypal"
      ? "paypal"
      : options?.paymentMethod === "whop"
        ? "whop"
        : "bank_transfer";
  if (!options?.skipBankConfiguration && !resolveBankTransfer(process.env)) {
    throw new Error("Bank transfer is not configured");
  }
  const sql = databaseFor(options);
  if (!sql) {
    throw new Error("Orders are unavailable until the database is configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }
  const shipping = normalizeShipping(input.shipping);
  if (!shipping) {
    throw new Error("A shipping address is required");
  }

  const catalogueLines = resolveCartLines(input.items);
  const email = trimmed(input.email, 200).toLowerCase();
  const membershipOnly = catalogueLines.every((line) => line.slug === MEMBERSHIP_SLUG);
  const now = options?.membership?.now?.() ?? new Date();
  const activeMember = membershipOnly ? false : await membershipActive(email, options);
  const lines = catalogueLines.map((line) => {
    if (!activeMember || !isMemberSpecial(line.slug, now)) return line;
    return { ...line, unitAmountCents: memberUnitCents(line.unitAmountCents) };
  });
  const promo = membershipOnly ? null : lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const cardPriced = paymentMethod === "whop" ? priceCardOrderCents(subtotalCents, promo) : null;
  const payableCents = cardPriced
    ? cardPriced.totalCents
    : subtotalCents - promoDiscountCents(subtotalCents, promo);
  if (payableCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  const totalCents = payableCents;

  const items: OrderItemSnapshot[] = lines.map((line) => ({
    slug: line.slug,
    name: lineLabel(line),
    option: line.option,
    variantLabel: line.variantLabel,
    sku: line.sku,
    qty: line.qty,
    unitAmountCents: line.unitAmountCents,
  }));
  const firstName = trimmed(input.firstName, 120) || "Customer";
  const lastName = trimmed(input.lastName, 120) || "Account";
  const promoCode = promo?.code ?? null;

  const reference = await withTimeout(
      insertOrder(
        {
          currency: "aud",
          subtotalCents,
          totalCents,
          promoCode,
          firstName,
          lastName,
          email,
          items,
          shipping,
          clubEmail: activeMember ? email : null,
          clubPointsRedeemed: 0,
          clubDiscountCents: 0,
          paymentMethod,
          paypalOrderId: options?.paypalOrderId ?? null,
          status: paymentMethod === "whop" ? "pending" : "awaiting_payment",
        },
        sql,
      ),
      DATABASE_TIMEOUT_MS,
      "The order database",
    );

  const notice: OrderCreatedNotice = {
    clubDiscountCents: 0,
    reference,
    firstName,
    lastName,
    email,
    items,
    subtotalCents,
    totalCents,
    promoCode,
    shipping,
  };
  try {
    if (!options?.skipCreatedEmail) {
      if (options?.deliver) await options.deliver(notice);
      else await deliverOrderNotice(reference, notice);
    }
  } catch (error) {
    console.error("[mailer] order email failed", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
      errorMessage: redactError(error),
    });
  }

  return {
    reference,
    redirectUrl: `/order/${reference}`,
    totalCents,
    subtotalCents,
    promoCode,
    promoPercentOff: promo?.percentOff ?? 0,
    email,
    firstName,
    lastName,
    items,
    lines,
    shipping,
    paymentMethod,
  };
}

async function membershipActive(email: string, options?: CreateBankTransferOrderOptions) {
  if (options?.membership) return options.membership.isActive(email);
  try {
    return await isActiveMember(email, databaseFor(options), options?.membership?.now?.());
  } catch (error) {
    console.error("[club] membership lookup failed", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
