import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { requestOrigin, stripe, stripeConfigured } from "@/lib/stripe";

export async function createEmbeddedCheckoutSession(input: {
  items: CartLineInput[];
  email?: string;
  firstName?: string;
  lastName?: string;
}) {
  if (!stripeConfigured()) {
    throw new Error("Stripe is not configured");
  }

  const lines = resolveCartLines(input.items);
  const origin = await requestOrigin();
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const email = input.email?.trim();

  const session = await stripe.checkout.sessions.create({
    ui_mode: "embedded_page",
    mode: "payment",
    ...(email ? { customer_email: email, client_reference_id: email } : {}),
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["AU"] },
    line_items: lines.map((line) => ({
      quantity: line.qty,
      price_data: {
        currency: "aud",
        unit_amount: line.unitAmountCents,
        product_data: {
          name: lineLabel(line),
          metadata: {
            slug: line.slug,
            sku: line.sku,
            option: line.option ?? "",
          },
        },
      },
    })),
    metadata: {
      customer_name: name,
      age_confirmed: "true",
      research_use: "true",
    },
    return_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
  });

  if (!session.client_secret) {
    throw new Error("Stripe did not return a client secret");
  }

  return session.client_secret;
}
