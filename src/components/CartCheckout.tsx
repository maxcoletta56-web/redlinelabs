"use client";

import { useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { startCartCheckoutSession } from "@/app/actions/stripe";
import type { CartLineInput } from "@/lib/order";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

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
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const router = useRouter();
  const sessionIdRef = useRef<string | null>(null);

  const fetchClientSecret = useCallback(async () => {
    const secret = await startCartCheckoutSession({
      items,
      email,
      firstName,
      lastName,
      ageConfirmed,
      researchUse,
    });
    sessionIdRef.current = sessionIdFromClientSecret(secret);
    return secret;
  }, [items, email, firstName, lastName, ageConfirmed, researchUse]);

  const onComplete = useCallback(() => {
    const sessionId = sessionIdRef.current;
    router.push(sessionId ? `/checkout/success?session_id=${sessionId}` : "/checkout/success");
  }, [router]);

  return (
    <div id="checkout">
      <EmbeddedCheckoutProvider
        stripe={stripePromise}
        options={{ fetchClientSecret, onComplete }}
      >
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    </div>
  );
}
