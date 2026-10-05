"use client";

import { useEffect, useId, useRef } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

export type WhopPaymentError = {
  message?: string;
  code?: string;
};

type CallbackWindow = Window & Record<string, unknown>;

/**
 * Whop's embedded checkout element. It stays on /checkout. 3D Secure and other
 * redirects from the card issuer come back to `returnUrl` with `status=success`
 * or `status=error`. `onPaymentError` covers declines and authentication
 * failures; the caller remounts this element so the customer can try again.
 */
export function WhopCheckoutElement({
  sessionId,
  planId,
  returnUrl,
  environment,
  email,
  onComplete,
  onPaymentError,
}: {
  sessionId: string;
  planId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  email: string;
  onComplete: (receiptId: string) => void;
  onPaymentError: (error: WhopPaymentError) => void;
}) {
  const suffix = useId().replace(/[^a-zA-Z0-9]/g, "");
  const completeName = `rlWhopComplete${suffix}`;
  const errorName = `rlWhopError${suffix}`;
  const onCompleteRef = useRef(onComplete);
  const onPaymentErrorRef = useRef(onPaymentError);
  onCompleteRef.current = onComplete;
  onPaymentErrorRef.current = onPaymentError;

  useEffect(() => {
    const target = window as CallbackWindow;
    target[completeName] = (_planId: string, receiptId: string) => {
      onCompleteRef.current(typeof receiptId === "string" ? receiptId : "");
    };
    target[errorName] = (error: WhopPaymentError) => {
      onPaymentErrorRef.current(error ?? {});
    };

    if (!document.querySelector(`script[src="${LOADER_SRC}"]`)) {
      const script = document.createElement("script");
      script.src = LOADER_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    return () => {
      delete target[completeName];
      delete target[errorName];
    };
  }, [completeName, errorName, sessionId, planId]);

  return (
    <div
      id={`whop-embedded-checkout-${suffix}`}
      data-whop-checkout-plan-id={planId}
      data-whop-checkout-session={sessionId}
      data-whop-checkout-return-url={returnUrl}
      data-whop-checkout-environment={environment}
      data-whop-checkout-theme="dark"
      data-whop-checkout-theme-accent-color="#d4af37"
      data-whop-checkout-theme-background-color="#0b0b0b"
      data-whop-checkout-prefill-email={email}
      data-whop-checkout-on-complete={completeName}
      data-whop-checkout-on-payment-error={errorName}
      data-whop-checkout-hide-price="false"
      className="min-h-[640px] w-full"
    />
  );
}
