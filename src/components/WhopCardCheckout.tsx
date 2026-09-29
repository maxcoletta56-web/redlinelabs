"use client";

import { useEffect, useState } from "react";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { withTimeout } from "@/lib/with-timeout";

const SUBMIT_TIMEOUT_MS = 25_000;

type Session = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
};

export function WhopCardCheckout({
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
  shipping: ShippingAddressInput;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      startWhopCardCheckout({
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        ageConfirmed,
        researchUse,
      }),
      SUBMIT_TIMEOUT_MS,
      "Card checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSession({
            reference: result.reference,
            sessionId: result.sessionId,
            planId: result.planId,
            environment: result.environment,
            returnUrl: result.returnUrl,
          });
          return;
        }
        setError(result.error);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("whop checkout failed", reason);
        setError(
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Card checkout is taking longer than expected. Nothing has been charged."
            : "Card checkout could not be started. Nothing has been charged.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse]);

  if (error) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm leading-6 text-[#d4af37]">{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null);
            setSession(null);
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

  if (!session) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing the card form. The amount is calculated on the server.
      </p>
    );
  }

  return (
    <WhopCheckoutElement
      planId={session.planId}
      sessionId={session.sessionId}
      returnUrl={session.returnUrl}
      environment={session.environment}
      email={email}
      address={{
        name: shipping.name,
        line1: shipping.line1,
        line2: shipping.line2,
        city: shipping.city,
        state: shipping.state,
        postalCode: shipping.postal_code,
      }}
    />
  );
}
