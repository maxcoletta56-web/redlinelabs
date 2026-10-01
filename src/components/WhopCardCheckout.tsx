"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { formatPrice } from "@/lib/products";
import type { WhopEmbedSession } from "@/lib/whop-plan";
import { withTimeout } from "@/lib/with-timeout";

const SUBMIT_TIMEOUT_MS = 40_000;
const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type WindowWithWhop = Window & {
  redlineWhopCheckoutComplete?: (planId: string, receiptId?: string) => void;
  redlineWhopPaymentError?: (error: { message?: string; code?: string }) => void;
};

function WhopCheckoutElement({
  session,
  email,
  shipping,
  onComplete,
  onPaymentError,
}: {
  session: WhopEmbedSession;
  email: string;
  shipping?: ShippingAddressInput | null;
  onComplete: () => void;
  onPaymentError: (message: string) => void;
}) {
  const onCompleteRef = useRef(onComplete);
  const onPaymentErrorRef = useRef(onPaymentError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPaymentErrorRef.current = onPaymentError;
  }, [onComplete, onPaymentError]);

  useEffect(() => {
    const target = window as WindowWithWhop;
    target.redlineWhopCheckoutComplete = () => onCompleteRef.current();
    target.redlineWhopPaymentError = (error) => {
      onPaymentErrorRef.current(error?.message || "The card payment did not go through.");
    };

    const script = document.createElement("script");
    script.src = `${LOADER_SRC}?session=${encodeURIComponent(session.sessionId)}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
      delete target.redlineWhopCheckoutComplete;
      delete target.redlineWhopPaymentError;
    };
  }, [session.sessionId]);

  return (
    <div
      id={`whop-checkout-${session.sessionId}`}
      data-whop-checkout-plan-id={session.planId}
      data-whop-checkout-session={session.sessionId}
      data-whop-checkout-return-url={session.returnUrl}
      data-whop-checkout-environment={session.environment}
      data-whop-checkout-theme="dark"
      data-whop-checkout-theme-accent-color="#d4af37"
      data-whop-checkout-theme-background-color="#0b0b0b"
      data-whop-checkout-prefill-email={email}
      data-whop-checkout-disable-email="true"
      data-whop-checkout-prefill-name={shipping?.name || undefined}
      data-whop-checkout-prefill-address-line1={shipping?.line1 || undefined}
      data-whop-checkout-prefill-address-line2={shipping?.line2 || undefined}
      data-whop-checkout-prefill-address-city={shipping?.city || undefined}
      data-whop-checkout-prefill-address-state={shipping?.state || undefined}
      data-whop-checkout-prefill-address-postal-code={shipping?.postal_code || undefined}
      data-whop-checkout-prefill-address-country={shipping?.country || "AU"}
      data-whop-checkout-on-complete="redlineWhopCheckoutComplete"
      data-whop-checkout-on-payment-error="redlineWhopPaymentError"
      className="min-h-[640px]"
    />
  );
}

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
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<WhopEmbedSession | null>(null);
  const [submitted, setSubmitted] = useState(false);

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
      "Checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok) {
          setSession(result);
          return;
        }
        setError(result.error);
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

  if (submitted && session) {
    return (
      <div className="space-y-3">
        <ClearCartOnSuccess />
        <p className="text-sm leading-6 text-[#8f8c84]" role="status">
          Card payment for {session.reference} was submitted. If your bank asked for 3D Secure
          or another confirmation, finishing it brings you back to this checkout. The order
          is marked paid when Whop confirms the payment, and the confirmation email follows.
        </p>
        <Link href={`/order/${session.reference}`} className="btn">
          View order
        </Link>
      </div>
    );
  }

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
            setSubmitted(false);
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
        Calculating the order total and opening card checkout.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Card charge {formatPrice(session.totalCents / 100)} AUD, calculated on the server.
        Paying as {email}.
      </p>
      <WhopCheckoutElement
        session={session}
        email={email}
        shipping={shipping}
        onComplete={() => setSubmitted(true)}
        onPaymentError={(message) => setError(message)}
      />
    </div>
  );
}
