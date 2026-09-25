"use client";

import { useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { startCartCheckoutSession } from "@/app/actions/stripe";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import type { CartLineInput } from "@/lib/order";

function sessionIdFromClientSecret(secret: string) {
  const marker = "_secret_";
  const index = secret.indexOf(marker);
  return index === -1 ? null : secret.slice(0, index);
}

export function CartCheckout({
  items,
  email,
  firstName,
  lastName,
  publishableKey,
  shipping,
  promoCode,
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  publishableKey: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const router = useRouter();
  const sessionIdRef = useRef<string | null>(null);
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);

  const fetchClientSecret = useCallback(async () => {
    const secret = await startCartCheckoutSession({
      items,
      email,
      firstName,
      lastName,
      shipping,
      promoCode,
      ageConfirmed,
      researchUse,
    });
    sessionIdRef.current = sessionIdFromClientSecret(secret);
    return secret;
  }, [items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse]);

  const onComplete = useCallback(() => {
    const sessionId = sessionIdRef.current;
    router.push(sessionId ? `/checkout/success?session_id=${sessionId}` : "/checkout/success");
  }, [router]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        key={promoCode ?? "none"}
        stripe={stripePromise}
        options={{ fetchClientSecret, onComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
