import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { BRAND_NAME } from "@/lib/company";
import { lineLabel, resolveCartLines, type CartLineInput, type ResolvedLine } from "@/lib/order";
import {
  buildPaypalOrder,
  confirmPaypalOrder,
  createPaypalOrder,
  isPaypalOrderId,
  paypalMoney,
  resolvePaypal,
} from "@/lib/paypal";
import { lookupPromo, promoDiscountCents } from "@/lib/promo";
import { absoluteUrl } from "@/lib/seo";

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

function paypalAddress(shipping: ShippingAddressInput | null | undefined) {
  const line1 = shipping?.line1.trim() ?? "";
  const city = shipping?.city.trim() ?? "";
  const state = shipping?.state.trim() ?? "";
  const postalCode = shipping?.postal_code.trim() ?? "";
  const country = (shipping?.country?.trim() || "AU").toUpperCase();
  if (!line1 || !city || !state || !/^\d{4}$/.test(postalCode) || country !== "AU") {
    throw new Error("A complete Australian shipping address is required");
  }
  const line2 = shipping?.line2?.trim() ?? "";
  return {
    name: shipping?.name.trim() || "Customer",
    line1,
    ...(line2 ? { line2 } : {}),
    city,
    state,
    postalCode,
    countryCode: "AU" as const,
  };
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
  const config = resolvePaypal(process.env);
  if (!config) {
    throw new Error("PayPal is not configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const email = input.email?.trim() ?? "";
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promoOffCents = promoDiscountCents(subtotalCents, promo);
  const amountCents = subtotalCents - promoOffCents;
  const transactionId = `rl_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const firstName = input.firstName?.trim() || "Customer";
  const lastName = input.lastName?.trim() || "Account";
  const description = lines.map((line) => lineLabel(line)).join(", ");

  const order = await createPaypalOrder(
    config,
    buildPaypalOrder({
      transactionId,
      amountCents,
      subtotalCents,
      discountCents: promoOffCents,
      lines: lines.map((line) => ({
        name: lineLabel(line) || description,
        sku: line.sku,
        qty: line.qty,
        unitAmountCents: line.unitAmountCents,
      })),
      shipping: paypalAddress(input.shipping),
      email,
      firstName,
      lastName,
      returnUrl: absoluteUrl(`/checkout/success?session_id=${transactionId}`),
      cancelUrl: absoluteUrl("/checkout"),
      brandName: BRAND_NAME,
    }),
    transactionId,
  );

  const receipt: PaypalReceipt = {
    transactionId,
    orderId: order.id,
    email,
    amountCents,
    subtotalCents,
    currency: "aud",
    lines,
    shipping: input.shipping ?? null,
    promoCode: promo?.code ?? "",
    promoPercentOff: promo?.percentOff ?? 0,
  };
  const jar = await cookies();
  jar.set(RECEIPT_COOKIE, Buffer.from(JSON.stringify(receipt), "utf8").toString("base64url"), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 30,
  });

  return order.approvalUrl;
}

function readReceipt(value: string | undefined): PaypalReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PaypalReceipt;
    if (!parsed?.transactionId || !isPaypalOrderId(parsed.orderId) || !Array.isArray(parsed.lines)) {
      return null;
    }
    return parsed;
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
  return { receipt, paid: confirmed.paid, status: confirmed.order.status };
}
