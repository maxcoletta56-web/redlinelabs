"use client";

import { useCallback } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { startCartCheckoutSession, startCheckoutSession } from "@/app/actions/stripe";
import type { CartLineInput } from "@/lib/order";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export default function Checkout({ productId }: { productId: string }) {
  const startCheckoutSessionForProduct = useCallback(
    () => startCheckoutSession(productId),
    [productId],
  );

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret: startCheckoutSessionForProduct }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}

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
