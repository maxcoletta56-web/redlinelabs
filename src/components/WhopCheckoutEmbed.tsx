"use client";

import { useEffect, useId, useRef } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type PaymentError = { message?: string; code?: string };

/**
 * Whop's embedded Checkout Element. `returnUrl` is required so a 3D Secure or
 * other off-site next action can come back to this site. `onComplete` skips
 * the final redirect when the charge finishes inside the iframe. `onPaymentError`
 * covers declines and failures from 3D Secure or an external redirect.
 */
export function WhopCheckoutEmbed({
  planId,
  sessionId,
  returnUrl,
  environment,
  email,
  onComplete,
  onPaymentError,
}: {
  planId: string;
  sessionId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  email: string;
  onComplete: (planId: string, receiptId: string) => void;
  onPaymentError: (error: PaymentError) => void;
}) {
  const reactId = useId().replace(/:/g, "");
  const onCompleteName = `whopCheckoutComplete${reactId}`;
  const onErrorName = `whopCheckoutError${reactId}`;
  const onCompleteRef = useRef(onComplete);
  const onPaymentErrorRef = useRef(onPaymentError);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPaymentErrorRef.current = onPaymentError;
  }, [onComplete, onPaymentError]);

  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target[onCompleteName] = (completedPlanId: string, receiptId: string) => {
      onCompleteRef.current(completedPlanId, receiptId);
    };
    target[onErrorName] = (error: PaymentError) => {
      onPaymentErrorRef.current(error ?? {});
    };

    const previous = document.getElementById("whop-checkout-loader");
    previous?.remove();
    const script = document.createElement("script");
    script.id = "whop-checkout-loader";
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    return () => {
      delete target[onCompleteName];
      delete target[onErrorName];
      script.remove();
    };
  }, [onCompleteName, onErrorName, planId, sessionId]);

  return (
    <div
      data-whop-checkout-plan-id={planId}
      data-whop-checkout-session={sessionId}
      data-whop-checkout-return-url={returnUrl}
      data-whop-checkout-environment={environment}
      data-whop-checkout-theme="dark"
      data-whop-checkout-theme-accent-color="#d4af37"
      data-whop-checkout-theme-background-color="#111111"
      data-whop-checkout-prefill-email={email}
      data-whop-checkout-disable-email="true"
      data-whop-checkout-on-complete={onCompleteName}
      data-whop-checkout-on-payment-error={onErrorName}
      className="min-h-[680px]"
    />
  );
}
