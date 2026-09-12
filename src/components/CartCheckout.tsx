"use client";

import { useCallback } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { startCartCheckoutSession } from "@/app/actions/stripe";
import type { CartLineInput } from "@/lib/order";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export function CartCheckout({
  items,
  email,
  firstName,
  lastName,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
}) {
  const fetchClientSecret = useCallback(
    () => startCartCheckoutSession({ items, email, firstName, lastName }),
    [items, email, firstName, lastName],
  );

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
