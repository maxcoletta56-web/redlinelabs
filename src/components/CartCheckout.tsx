"use client";

import { useEffect, useState } from "react";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import type { CartLineInput } from "@/lib/order";

export function CartCheckout({
  items,
  email,
  firstName,
  lastName,
  shipping,
  promoCode,
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startCartCheckoutSession({
      items,
      email,
      firstName,
      lastName,
      shipping,
      promoCode,
      ageConfirmed,
      researchUse,
    })
      .then((redirectUrl) => {
        if (!cancelled) window.location.assign(redirectUrl);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Payoneer checkout failed");
      });
    return () => {
      cancelled = true;
    };
  }, [items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse]);

  if (error) {
    return (
      <p className="text-sm leading-6 text-[#d4af37]" role="alert">
        {error}
      </p>
    );
  }

  return (
    <p className="text-sm leading-6 text-[#8f8c84]" role="status">
      Redirecting to Payoneer to take payment.
    </p>
  );
}
