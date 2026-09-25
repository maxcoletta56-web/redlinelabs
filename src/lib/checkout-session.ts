import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { lookupPromo, promoDiscountCents, stripeCouponParams } from "@/lib/promo";
import { stripe, stripeConfigured, stripeMode } from "@/lib/stripe";
import { serverStoreCreditCents } from "@/lib/store-credit";

export type ShippingAddressInput = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
};

export async function createEmbeddedCheckoutSession(input: {
  items: CartLineInput[];
  email?: string;
  firstName?: string;
  lastName?: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  if (!stripeConfigured()) {
    throw new Error("Stripe is not configured");
  }
  if (!input.ageConfirmed || !input.researchUse) {
    throw new Error("Age and research-use confirmation are required");
  }

  const lines = resolveCartLines(input.items);
  const promo = lookupPromo(input.promoCode);
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const email = input.email?.trim();
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const promoOffCents = promoDiscountCents(subtotalCents, promo);
  const storeCreditCents = serverStoreCreditCents();

  let customerId: string | undefined;
  if (email) {
    const existing = await stripe.customers.list({ email, limit: 1 });
    const shipping = input.shipping
      ? {
          name: input.shipping.name || name || email,
          address: {
            line1: input.shipping.line1,
            line2: input.shipping.line2 || undefined,
            city: input.shipping.city,
            state: input.shipping.state,
            postal_code: input.shipping.postal_code,
            country: input.shipping.country || "AU",
          },
        }
      : undefined;
    if (existing.data[0]) {
      const updated = await stripe.customers.update(existing.data[0].id, {
        name: name || existing.data[0].name || undefined,
        shipping,
      });
      customerId = updated.id;
    } else {
      const created = await stripe.customers.create({
        email,
        name: name || undefined,
        shipping,
      });
      customerId = created.id;
    }
  }

  const coupon = stripeCouponParams({
    promo,
    promoOffCents,
    storeCreditCents,
  });
  const discounts = coupon
    ? [
        {
          coupon: (await stripe.coupons.create(coupon)).id,
        },
      ]
    : undefined;

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    redirect_on_completion: "never",
    line_items: lines.map((line) => ({
      price_data: {
        currency: "aud",
        product_data: {
          name: lineLabel(line),
          metadata: {
            slug: line.slug,
            sku: line.sku,
            option: line.option ?? "",
          },
        },
        unit_amount: line.unitAmountCents,
      },
      quantity: line.qty,
    })),
    mode: "payment",
    ...(customerId
      ? { customer: customerId, client_reference_id: email }
      : email
        ? { customer_email: email, client_reference_id: email }
        : {}),
    ...(discounts ? { discounts } : {}),
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["AU"] },
    metadata: {
      customer_name: name,
      age_confirmed: input.ageConfirmed ? "true" : "false",
      research_use: input.researchUse ? "true" : "false",
      store_credit_cents: String(storeCreditCents),
      promo_code: promo?.code ?? "",
      promo_percent_off: promo ? String(promo.percentOff) : "0",
      promo_discount_cents: String(promoOffCents),
      stripe_mode: stripeMode() ?? "",
    },
  });

  if (!session.client_secret) {
    throw new Error("Stripe did not return a client secret");
  }

  return session.client_secret;
}
