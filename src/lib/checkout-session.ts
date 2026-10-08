import "server-only";

import { cookies } from "next/headers";
import type { CartLineInput, ResolvedLine } from "@/lib/order";
import { normalizeOrderReference } from "@/lib/order-reference";
import {
  openPaypalCheckout,
  resumePaypalCheckout,
  settleCapturedPaypalOrder,
} from "@/lib/paypal-checkout";
import {
  confirmPaypalOrder,
  isPaypalOrderId,
  paypalMoney,
  resolvePaypal,
} from "@/lib/paypal";
import { lookupPromo } from "@/lib/promo";

export type ShippingAddressInput = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
};

export type PaypalReceipt = {
  transactionId: string;
  orderId: string;
  orderReference?: string;
  email: string;
  amountCents: number;
  subtotalCents: number;
  currency: "aud";
  lines: ResolvedLine[];
  shipping: ShippingAddressInput | null;
  promoCode: string;
  promoPercentOff: number;
};

const RECEIPT_COOKIE = "rl_paypal_checkout";

export function paypalConfigured() {
  return Boolean(resolvePaypal(process.env));
}

function snapshotShipping(
  shipping: {
    name: string;
    line1: string;
    line2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  } | null,
): ShippingAddressInput | null {
  if (!shipping) return null;
  const line2 = shipping.line2.trim();
  return {
    name: shipping.name,
    line1: shipping.line1,
    ...(line2 ? { line2 } : {}),
    city: shipping.city,
    state: shipping.state,
    postal_code: shipping.postcode,
    country: shipping.country,
  };
}

async function rememberPaypalReceipt(receipt: PaypalReceipt) {
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });
}

export async function createPaypalCheckout(input: {
  items: CartLineInput[];
  email?: string;
  firstName?: string;
  lastName?: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const placed = await openPaypalCheckout({
    items: input.items,
    email: input.email ?? "",
    firstName: input.firstName,
    lastName: input.lastName,
    shipping: input.shipping,
    promoCode: input.promoCode,
    ageConfirmed: input.ageConfirmed,
    researchUse: input.researchUse,
  });
  await rememberPaypalReceipt({
    transactionId: placed.transactionId,
    orderId: placed.paypalOrderId,
    orderReference: placed.reference,
    email: placed.email,
    amountCents: placed.totalCents,
    subtotalCents: placed.subtotalCents,
    currency: "aud",
    lines: placed.lines,
    shipping: snapshotShipping(placed.shipping),
    promoCode: placed.promoCode ?? "",
    promoPercentOff: placed.promoPercentOff,
  });
  return placed.approvalUrl;
}

/** Starts PayPal again for an unpaid PayPal order, or returns the order page. */
export async function resumePaypalCheckoutSession(reference: string) {
  const resumed = await resumePaypalCheckout(reference);
  if (resumed.kind === "order") return `/order/${resumed.reference}`;
  await rememberPaypalReceipt({
    transactionId: resumed.transactionId,
    orderId: resumed.paypalOrderId,
    orderReference: resumed.order.reference,
    email: resumed.order.email,
    amountCents: resumed.order.totalCents,
    subtotalCents: resumed.order.subtotalCents,
    currency: "aud",
    lines: resumed.order.items.map((item) => ({
      slug: item.slug,
      name: item.name,
      option: item.option,
      variantLabel: item.variantLabel,
      sku: item.sku,
      qty: item.qty,
      unitAmountCents: item.unitAmountCents,
    })),
    shipping: snapshotShipping(resumed.order.shipping),
    promoCode: resumed.order.promoCode ?? "",
    promoPercentOff: lookupPromo(resumed.order.promoCode)?.percentOff ?? 0,
  });
  return resumed.approvalUrl;
}

function readReceipt(value: string | undefined): PaypalReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PaypalReceipt;
    if (!parsed?.transactionId || !isPaypalOrderId(parsed.orderId) || !Array.isArray(parsed.lines)) {
      return null;
    }
    const orderReference = normalizeOrderReference(parsed.orderReference) ?? undefined;
    return { ...parsed, orderReference };
  } catch {
    return null;
  }
}

export async function loadPaypalReceipt(sessionId?: string | null): Promise<{
  receipt: PaypalReceipt;
  paid: boolean;
  status: string | null;
} | null> {
  const config = resolvePaypal(process.env);
  if (!config) return null;
  const jar = await cookies();
  const receipt = readReceipt(jar.get(RECEIPT_COOKIE)?.value);
  if (!receipt) return null;
  if (sessionId && sessionId !== receipt.transactionId) return null;

  const confirmed = await confirmPaypalOrder(config, receipt.orderId, {
    transactionId: receipt.transactionId,
    amount: paypalMoney(receipt.amountCents),
  });
  if (confirmed.paid && receipt.orderReference) {
    const settled = await settleCapturedPaypalOrder({
      reference: receipt.orderReference,
      paypalOrderId: receipt.orderId,
      amountCents: receipt.amountCents,
      currency: receipt.currency,
      captured: true,
    });
    if (!settled.ok) {
      throw new Error("PayPal could not confirm this payment");
    }
  }
  return { receipt, paid: confirmed.paid, status: confirmed.order.status };
}
