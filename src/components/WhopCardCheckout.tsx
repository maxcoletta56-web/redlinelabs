"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { resumeWhopCardSession, startWhopCardCheckout } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { withTimeout } from "@/lib/with-timeout";
import { WhopCheckoutEmbed } from "@/components/WhopCheckoutEmbed";

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
  existingReference,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  existingReference?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<Session | null>(null);
  const referenceRef = useRef(existingReference ?? "");
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const knownReference = referenceRef.current;
    const start = knownReference
      ? resumeWhopCardSession(knownReference)
      : startWhopCardCheckout({
          items,
          email,
          firstName,
          lastName,
          shipping,
          promoCode,
          ageConfirmed,
          researchUse,
        });
    withTimeout(start, SUBMIT_TIMEOUT_MS, "Checkout")
      .then((result) => {
        if (cancelled) return;
        if (result.reference) referenceRef.current = result.reference;
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSession({
          reference: result.reference,
          sessionId: result.sessionId,
          planId: result.planId,
          environment: result.environment,
          returnUrl: result.returnUrl,
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Checkout is taking longer than expected. Nothing has been charged."
            : "Checkout could not be started. Nothing has been charged.",
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
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!session) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing the card checkout.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {session.environment === "sandbox" && (
        <p className="text-xs leading-6 text-[#8f8c84]">
          Sandbox mode. Use test card 4242 4242 4242 4242 for a successful payment, 4000 0000
          0000 0002 for a decline, or 5385 3083 6013 5181 when the bank asks for 3D Secure
          (password Checkout1!). Any future expiry and any three-digit security code work.
        </p>
      )}
      {paymentError && (
        <div className="space-y-3" role="alert">
          <p className="text-sm leading-6 text-[#d4af37]">{paymentError}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPaymentError(null);
              setSession(null);
              setAttempt((count) => count + 1);
            }}
          >
            Try the card again
          </button>
        </div>
      )}
      {!paymentError && (
        <WhopCheckoutEmbed
          key={`${session.sessionId}-${attempt}`}
          planId={session.planId}
          sessionId={session.sessionId}
          returnUrl={session.returnUrl}
          environment={session.environment}
          email={email}
          onComplete={() => {
            router.push(`/checkout/return/${session.reference}?status=success`);
          }}
          onPaymentError={(checkoutError) => {
            setPaymentError(checkoutError.message || "The card payment did not go through. Nothing was captured.");
          }}
        />
      )}
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
