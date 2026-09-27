import { COMPANY_EMAIL } from "./company.ts";
import type { StoredOrder } from "./orders.ts";

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)} AUD`;
}

/** Plain-text receipt. Card numbers are not included; Whop never sends them here. */
export function orderConfirmationText(order: StoredOrder) {
  const lines = order.items.map(
    (item) => `- ${item.name} × ${item.qty} — ${money(item.unitAmountCents * item.qty)}`,
  );
  const ship = order.shipping
    ? [
        order.shipping.name,
        order.shipping.line1,
        order.shipping.line2,
        [order.shipping.city, order.shipping.state, order.shipping.postcode].filter(Boolean).join(" "),
        order.shipping.country,
      ]
        .filter(Boolean)
        .join("\n")
    : "No shipping address was saved with this order.";

  return [
    `Your Redline Labs order ${order.reference} is paid.`,
    "",
    `Total: ${money(order.totalCents)}`,
    "",
    "Items:",
    ...lines,
    "",
    "Ship to:",
    ship,
    "",
    "The order is queued for dispatch. Questions about this order go to " + COMPANY_EMAIL + ".",
  ].join("\n");
}
