"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { formatPrice } from "@/lib/products";
import { withTimeout } from "@/lib/with-timeout";

const SUBMIT_TIMEOUT_MS = 25_000;
const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type CardSession = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  amountCents: number;
  currency: "aud";
};

type PaymentError = { message?: string; code?: string };

declare global {
  interface Window {
    redlineWhopCheckoutComplete?: (planId: string, receiptId: string) => void;
    redlineWhopCheckoutPaymentError?: (error: PaymentError) => void;
  }
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
  const [session, setSession] = useState<CardSession | null>(null);
  const [sessionAttempt, setSessionAttempt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [completedAttempt, setCompletedAttempt] = useState<number | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);
  const hostRef = useRef<HTMLDivElement>(null);
  const activeSession = sessionAttempt === attempt ? session : null;
  const completed = completedAttempt === attempt;

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      fetch("/api/checkout/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          email,
          firstName,
          lastName,
          shipping,
          promoCode,
          ageConfirmed,
          researchUse,
        }),
      }).then(async (response) => {
        const body = (await response.json().catch(() => null)) as { error?: string } | CardSession | null;
        if (!response.ok) {
          throw new Error(
            body && "error" in body && body.error
              ? body.error
              : "The card processor did not start checkout. Nothing has been charged.",
          );
        }
        return body as CardSession;
      }),
      SUBMIT_TIMEOUT_MS,
      "Checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (!result?.sessionId || !result.planId) {
          setError("The card processor did not start checkout. Nothing has been charged.");
          return;
        }
        setSession(result);
        setSessionAttempt(attempt);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Checkout is taking longer than expected. Nothing has been charged."
            : reason instanceof Error
              ? reason.message
              : "Checkout could not be started. Nothing has been charged.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !activeSession || completed) return;

    window.redlineWhopCheckoutComplete = () => {
      setCompletedAttempt(attempt);
      setPaymentError(null);
    };
    window.redlineWhopCheckoutPaymentError = (payment) => {
      setPaymentError(
        payment?.message?.trim() ||
          "The card payment did not complete. You can try the card again. Nothing else is charged until it succeeds.",
      );
    };

    host.replaceChildren();
    const element = document.createElement("div");
    element.setAttribute("data-whop-checkout-plan-id", activeSession.planId);
    element.setAttribute("data-whop-checkout-session", activeSession.sessionId);
    element.setAttribute("data-whop-checkout-return-url", activeSession.returnUrl);
    element.setAttribute("data-whop-checkout-environment", activeSession.environment);
    element.setAttribute("data-whop-checkout-theme", "dark");
    element.setAttribute("data-whop-checkout-theme-accent-color", "#d4af37");
    element.setAttribute("data-whop-checkout-theme-background-color", "#080808");
    element.setAttribute("data-whop-checkout-theme-border-radius", "0");
    element.setAttribute("data-whop-checkout-prefill-email", email);
    element.setAttribute("data-whop-checkout-hide-email", "true");
    element.setAttribute("data-whop-checkout-disable-email", "true");
    element.setAttribute("data-whop-checkout-hide-address", "true");
    if (shipping?.line1) {
      const name = shipping.name || `${firstName} ${lastName}`.trim();
      element.setAttribute("data-whop-checkout-prefill-name", name);
      element.setAttribute("data-whop-checkout-prefill-address-name", name);
      element.setAttribute("data-whop-checkout-prefill-address-country", shipping.country || "AU");
      element.setAttribute("data-whop-checkout-prefill-address-line1", shipping.line1);
      if (shipping.line2) element.setAttribute("data-whop-checkout-prefill-address-line2", shipping.line2);
      element.setAttribute("data-whop-checkout-prefill-address-city", shipping.city);
      element.setAttribute("data-whop-checkout-prefill-address-state", shipping.state);
      element.setAttribute("data-whop-checkout-prefill-address-postal-code", shipping.postal_code);
    }
    element.setAttribute("data-whop-checkout-on-complete", "redlineWhopCheckoutComplete");
    element.setAttribute("data-whop-checkout-on-payment-error", "redlineWhopCheckoutPaymentError");
    host.appendChild(element);

    const existing = document.getElementById("whop-checkout-loader");
    existing?.remove();
    const script = document.createElement("script");
    script.id = "whop-checkout-loader";
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      setPaymentError("The card form could not be loaded. Nothing has been charged.");
    };
    document.body.appendChild(script);

    return () => {
      delete window.redlineWhopCheckoutComplete;
      delete window.redlineWhopCheckoutPaymentError;
      script.remove();
    };
  }, [activeSession, generation, completed, attempt, email, firstName, lastName, shipping]);

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

  if (!activeSession) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing the card form from the catalogue total.
      </p>
    );
  }

  if (completed) {
    return (
      <div className="space-y-3" role="status">
        <ClearCartOnSuccess />
        <p className="text-sm leading-6 text-[#8f8c84]">
          The card form accepted {formatPrice(activeSession.amountCents / 100)} AUD for order{" "}
          {activeSession.reference}. The order is marked paid when Whop confirms the payment, and the
          receipt email is sent then.
        </p>
        <Link href={`/order/${activeSession.reference}`} className="btn">
          View order
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Card payment of {formatPrice(activeSession.amountCents / 100)} AUD for order {activeSession.reference}.
        Paying as {email}. If the bank asks you to verify the card, complete that step in the form.
        A redirect back here with an error leaves the order unpaid so you can try again.
      </p>
      {activeSession.environment === "sandbox" && (
        <p className="text-xs leading-6 text-[#8f8c84]">
          Sandbox mode. Test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 declines, and
          5385 3083 6013 5181 asks for 3D Secure. Use any future expiry and any CVC.
        </p>
      )}
      {paymentError && (
        <div className="space-y-2" role="alert">
          <p className="text-sm leading-6 text-[#d4af37]">{paymentError}</p>
          <button type="button" className="btn" onClick={() => {
            setPaymentError(null);
            setGeneration((count) => count + 1);
          }}>
            Try the card again
          </button>
        </div>
      )}
      <div ref={hostRef} className="min-h-40" />
    </div>
  );
}
