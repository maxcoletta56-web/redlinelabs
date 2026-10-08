"use client";

import { useEffect, useState } from "react";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import { useClub } from "@/lib/club-state";
import type { CartLineInput } from "@/lib/order";
import type { CheckoutPaymentMethod } from "@/lib/payments-provider";
import { withTimeout } from "@/lib/with-timeout";

/** Longer than the server-side provider timeout so the server message wins. */
const SUBMIT_TIMEOUT_MS = 25_000;

const PENDING_COPY = {
  bank_transfer: "Creating your order and payment instructions.",
  paypal: "Redirecting to PayPal card checkout to take payment.",
} as const;

export function CartCheckout({
  items,
  email,
  firstName,
  lastName,
  shipping,
  promoCode,
  paymentMethod = "bank_transfer",
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  paymentMethod?: CheckoutPaymentMethod;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { member, points } = useClub();

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      startCartCheckoutSession({
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        // Points are a request on PayID only. PayPal is always the full total.
        club:
          paymentMethod === "bank_transfer" && member && points > 0
            ? { email: member.email, code: member.code, points }
            : null,
        paymentMethod,
        ageConfirmed,
        researchUse,
      }),
      SUBMIT_TIMEOUT_MS,
      "Checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          window.location.assign(result.redirectUrl);
          return;
        }
        setError(result.error);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("checkout submit failed", reason);
        setError(
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Checkout is taking longer than expected. Nothing has been charged."
            : "Checkout could not be started. Nothing has been charged.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [
    attempt,
    items,
    email,
    firstName,
    lastName,
    shipping,
    promoCode,
    paymentMethod,
    ageConfirmed,
    researchUse,
    member,
    points,
  ]);

  if (error) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm leading-6 text-[#d4af37]">{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null);
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </button>
        <p className="text-xs leading-6 text-[#8f8c84]">
          Having trouble? Email{" "}
          <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
            {COMPANY_EMAIL}
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <p className="text-sm leading-6 text-[#8f8c84]" role="status">
      {PENDING_COPY[paymentMethod]}
    </p>
  );
}
