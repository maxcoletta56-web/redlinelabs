import "server-only";

import { isAuState } from "@/lib/account-data";
import { activeClubProgram, resolveRedemption, type ActiveClubProgram } from "@/lib/club";
import { authenticateMember, releaseRedemption, reserveRedemption } from "@/lib/club-db";
import { allowCredentialAttempt } from "@/lib/club-rate-limit";
import { resolveBankTransfer } from "@/lib/bank-transfer";
import { getSql, type Sql } from "@/lib/db";
import { sendOrderCreatedEmails, type OrderCreatedNotice } from "@/lib/mailer";
import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "@/lib/order";
import { generateOrderReference } from "@/lib/order-reference";
import {
  insertOrder,
  ordersConfigured,
  type OrderItemSnapshot,
  type OrderShippingSnapshot,
} from "@/lib/orders";
import type { CheckoutPaymentMethod } from "@/lib/payments-provider";
import { lookupPromo, promoDiscountCents } from "@/lib/promo";
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
  /** Injected by tests. Production reads the club tables through club-db. */
  club?: {
    program?: ActiveClubProgram | null;
    authenticate?: typeof authenticateMember;
    reserve?: typeof reserveRedemption;
    release?: typeof releaseRedemption;
    allowAttempt?: (email: string) => { ok: boolean };
    reference?: () => string;
  };
  /** Injected by tests. Production schedules mail and never awaits the send. */
  deliver?: (notice: OrderCreatedNotice) => Promise<void>;
  paymentMethod?: CheckoutPaymentMethod;
  paypalOrderId?: string | null;
  /**
   * PayPal records the order before a card is captured, and does not need
   * PayID details to do that. Bank transfer still requires them.
   */
  skipBankConfiguration?: boolean;
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
  const paymentMethod = options?.paymentMethod === "paypal" ? "paypal" : "bank_transfer";
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

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const payableCents = subtotalCents - promoDiscountCents(subtotalCents, promo);
  if (payableCents <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  // Redemption is per order, and only on PayID. A club payload sent with PayPal
  // is ignored so the card is charged the full total. Points are reserved
  // against a reference allocated up front, so the reservation, the order and
  // any later release all share one idempotency key.
  const reservation =
    paymentMethod === "bank_transfer"
      ? await reserveClubPoints(input.club, payableCents, options)
      : null;
  const totalCents = payableCents - (reservation?.discountCents ?? 0);

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
  const email = trimmed(input.email, 200).toLowerCase();
  const promoCode = promo?.code ?? null;

  let reference: string;
  try {
    reference = await withTimeout(
      insertOrder(
        {
          reference: reservation?.reference,
          currency: "aud",
          subtotalCents,
          totalCents,
          promoCode,
          firstName,
          lastName,
          email,
          items,
          shipping,
          clubEmail: reservation?.email ?? null,
          clubPointsRedeemed: reservation?.points ?? 0,
          clubDiscountCents: reservation?.discountCents ?? 0,
          paymentMethod,
          paypalOrderId: options?.paypalOrderId ?? null,
        },
        sql,
      ),
      DATABASE_TIMEOUT_MS,
      "The order database",
    );
  } catch (error) {
    // The points were taken off the balance before the insert; give them back.
    if (reservation) await releaseClubPoints(reservation.reference, options);
    throw error;
  }

  const notice: OrderCreatedNotice = {
    clubDiscountCents: reservation?.discountCents ?? 0,
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
    if (options?.deliver) {
      await options.deliver(notice);
    } else {
      await deliverOrderNotice(reference, notice);
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

type ClubReservation = {
  reference: string;
  email: string;
  points: number;
  discountCents: number;
};

/**
 * Verifies the member server-side, re-caps the requested points against the
 * live balance and this order's size, then reserves them in one atomic
 * statement before the order is written. Nothing here trusts the client's
 * balance or discount. A club failure never blocks the order: the customer
 * simply pays the undiscounted total.
 */
async function reserveClubPoints(
  club: ClubRedemptionInput | null | undefined,
  payableCents: number,
  options?: CreateBankTransferOrderOptions,
): Promise<ClubReservation | null> {
  if (!club || club.points <= 0) return null;
  const program =
    options?.club && "program" in options.club ? options.club.program ?? null : activeClubProgram();
  if (!program) return null;
  try {
    const allowed = (options?.club?.allowAttempt ?? allowCredentialAttempt)(club.email);
    if (!allowed.ok) return null;
    const sql = databaseFor(options);
    const member = await (options?.club?.authenticate ?? authenticateMember)(
      club.email,
      club.code,
      sql,
    );
    if (!member) return null;
    const { points, discountCents } = resolveRedemption(program, {
      requestedPoints: club.points,
      balancePoints: member.pointsBalance,
      payableCents,
    });
    if (points <= 0) return null;
    const reference = (options?.club?.reference ?? generateOrderReference)();
    const result = await (options?.club?.reserve ?? reserveRedemption)(
      { email: member.email, points, orderReference: reference },
      sql,
    );
    if (result.status !== "reserved") return null;
    return { reference, email: member.email, points, discountCents };
  } catch (error) {
    console.error("[club] could not apply points at checkout", {
      errorName: error instanceof Error ? error.name : "unknown",
    });
    return null;
  }
}

async function releaseClubPoints(reference: string, options?: CreateBankTransferOrderOptions) {
  try {
    await (options?.club?.release ?? releaseRedemption)(
      reference,
      "Order was not created",
      databaseFor(options),
    );
  } catch (error) {
    console.error("[club] could not return held points; run club reconciliation", {
      reference,
      errorName: error instanceof Error ? error.name : "unknown",
    });
  }
}
