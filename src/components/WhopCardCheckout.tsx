"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import type { WhopEnvironment } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";

const SUBMIT_TIMEOUT_MS = 25_000;

const SESSION_KEY = "rl_whop_checkout";

const CHECKOUT_LOADER = "https://js.whop.com/static/checkout/loader.js";

export type WhopEmbedSession = {
  reference: string;
  sessionId: string;
  planId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  email: string;
  address: {
    name: string;
    country: string;
    line1: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

export function rememberWhopSession(session: WhopEmbedSession) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // A private browser can still pay. The return page asks them to start again.
  }
}

export function readWhopSession(reference: string): WhopEmbedSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WhopEmbedSession;
    if (parsed.reference !== reference || !parsed.sessionId || !parsed.planId) return null;
    if (parsed.environment !== "sandbox" && parsed.environment !== "production") return null;
    return parsed;
  } catch {
    return null;
  }
}

type PaymentError = { message?: string; code?: string };

/**
 * Whop's checkout element. The loader script mounts the card iframe, including
 * 3D Secure and other off-site steps, and returns the browser to `returnUrl`.
 * `onComplete` skips only the final redirect. A declined charge or a failed
 * verification calls `onPaymentError` so the element can be remounted.
 */
export function WhopCheckoutElement({
  session,
  embedKey,
  onPaymentError,
}: {
  session: WhopEmbedSession;
  embedKey: number;
  onPaymentError: (message: string) => void;
}) {
  const router = useRouter();
  const completeName = `rlWhopComplete_${embedKey}`;
  const errorName = `rlWhopError_${embedKey}`;

  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target[completeName] = () => {
      router.push(`/checkout/return/${session.reference}?status=success`);
    };
    target[errorName] = (error: PaymentError) => {
      onPaymentError(error?.message?.trim() || "The card payment did not go through.");
    };
    return () => {
      delete target[completeName];
      delete target[errorName];
    };
  }, [completeName, errorName, onPaymentError, router, session.reference]);

  return (
    <>
      <Script src={CHECKOUT_LOADER} strategy="afterInteractive" />
      <div
        key={embedKey}
        data-whop-checkout-plan-id={session.planId}
        data-whop-checkout-session={session.sessionId}
        data-whop-checkout-return-url={session.returnUrl}
        data-whop-checkout-environment={session.environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#11110f"
        data-whop-checkout-hide-price="true"
        data-whop-checkout-prefill-email={session.email}
        data-whop-checkout-prefill-name={session.address.name}
        data-whop-checkout-prefill-address-country={session.address.country}
        data-whop-checkout-prefill-address-line1={session.address.line1}
        data-whop-checkout-prefill-address-city={session.address.city}
        data-whop-checkout-prefill-address-state={session.address.state}
        data-whop-checkout-prefill-address-postal-code={session.address.postalCode}
        data-whop-checkout-on-complete={completeName}
        data-whop-checkout-on-payment-error={errorName}
      />
    </>
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
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [embedKey, setEmbedKey] = useState(0);
  const [session, setSession] = useState<WhopEmbedSession | null>(null);

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      startCartCheckoutSession({
        method: "card",
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
        if (!result.ok || result.method !== "card") {
          setError(result.ok ? "Card checkout could not be started." : result.error);
          return;
        }
        const line2 = shipping?.line2?.trim();
        const next: WhopEmbedSession = {
          reference: result.reference,
          sessionId: result.sessionId,
          planId: result.planId,
          environment: result.environment,
          returnUrl: result.returnUrl,
          email,
          address: {
            name: shipping?.name?.trim() || `${firstName} ${lastName}`.trim(),
            country: "AU",
            line1: [shipping?.line1, line2].filter(Boolean).join(", "),
            city: shipping?.city ?? "",
            state: shipping?.state ?? "",
            postalCode: shipping?.postal_code ?? "",
          },
        };
        rememberWhopSession(next);
        setSession(next);
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
        Preparing card checkout. The amount is calculated on the server.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {session.environment === "sandbox" ? (
        <p className="text-xs leading-5 text-[#8f8c84]" role="status">
          Sandbox card checkout. A live card is not charged.
        </p>
      ) : null}
      {paymentError ? (
        <div className="space-y-3" role="alert">
          <p className="text-sm leading-6 text-[#d4af37]">{paymentError}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPaymentError(null);
              setEmbedKey((key) => key + 1);
            }}
          >
            Try the card again
          </button>
        </div>
      ) : null}
      <WhopCheckoutElement
        session={session}
        embedKey={embedKey}
        onPaymentError={(message) => setPaymentError(message)}
      />
    </div>
  );
}
