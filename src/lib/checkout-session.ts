import { lineLabel, resolveCartLines, type CartLineInput } from "@/lib/order";
import { stripe, stripeConfigured } from "@/lib/stripe";

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
  const name = [input.firstName, input.lastName].filter(Boolean).join(" ").trim();
  const email = input.email?.trim();

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
    ...(email ? { customer_email: email, client_reference_id: email } : {}),
    billing_address_collection: "required",
    shipping_address_collection: { allowed_countries: ["AU"] },
    metadata: {
      customer_name: name,
      age_confirmed: "true",
      research_use: "true",
    },
  });

  if (!session.client_secret) {
    throw new Error("Stripe did not return a client secret");
  }

  return session.client_secret;
}
