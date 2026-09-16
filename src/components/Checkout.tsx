"use client";

import { useCallback, useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { startCheckoutSession } from "@/app/actions/stripe";

export default function Checkout({
  productId,
  publishableKey,
}: {
  productId: string;
  publishableKey: string;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
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
