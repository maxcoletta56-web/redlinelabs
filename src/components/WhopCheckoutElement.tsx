"use client";

import { useEffect, useRef, useState } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type ShippingPrefill = {
  name?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
};

function filled(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function errorMessage(payload: unknown) {
  if (typeof payload === "string" && payload.trim()) return payload.trim();
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "The card payment did not complete. You can try again.";
}

/**
 * Whop’s embedded checkout element. 3D Secure and other off-site steps run
 * inside the element; returnUrl receives status=success or status=error when
 * the buyer comes back, and onPaymentError covers a challenge that fails
 * without leaving the page. Remounting the element is how a declined attempt
 * is retried.
 */
export function WhopCheckoutElement({
  sessionId,
  planId,
  returnUrl,
  environment,
  email,
  shipping,
  onComplete,
}: {
  sessionId: string;
  planId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  email: string;
  shipping?: ShippingPrefill | null;
  onComplete: (planId: string, receiptId: string) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [names] = useState(() => {
    const id = Math.random().toString(36).slice(2);
    return { complete: `rlWhopComplete${id}`, error: `rlWhopError${id}` };
  });
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target[names.complete] = (completedPlanId: unknown, receiptId: unknown) => {
      onCompleteRef.current(String(completedPlanId ?? ""), String(receiptId ?? ""));
    };
    target[names.error] = (payload: unknown) => {
      setError(errorMessage(payload));
    };

    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.rlWhopLoader = String(attempt);
    document.body.appendChild(script);

    return () => {
      delete target[names.complete];
      delete target[names.error];
      script.remove();
    };
  }, [attempt, names, planId, sessionId]);

  return (
    <div className="space-y-3">
      {error && (
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
            Try the card again
          </button>
        </div>
      )}
      <div
        key={`${sessionId}-${attempt}`}
        className="min-h-[520px]"
        data-whop-checkout-plan-id={planId}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#0b0b0b"
        data-whop-checkout-on-complete={names.complete}
        data-whop-checkout-on-payment-error={names.error}
        data-whop-checkout-prefill-email={filled(email)}
        data-whop-checkout-prefill-address-name={filled(shipping?.name)}
        data-whop-checkout-prefill-address-country={filled(shipping?.country)}
        data-whop-checkout-prefill-address-line1={filled(shipping?.line1)}
        data-whop-checkout-prefill-address-line2={filled(shipping?.line2)}
        data-whop-checkout-prefill-address-city={filled(shipping?.city)}
        data-whop-checkout-prefill-address-state={filled(shipping?.state)}
        data-whop-checkout-prefill-address-postal-code={filled(shipping?.postalCode)}
        data-whop-checkout-style-container-padding-x="0"
        data-whop-checkout-style-container-padding-top="0"
      />
      <p className="text-xs leading-6 text-[#8f8c84]">
        Card details stay in Whop’s checkout element. A 3D Secure or bank check
        opens from that form and returns here when it finishes.
      </p>
    </div>
  );
}
