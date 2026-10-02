"use client";

import { useEffect, useRef } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type PaymentError = { message?: string; code?: string };

/**
 * Whop's embedded checkout element. `returnUrl` is where the browser lands
 * after 3D Secure or another redirect next action. `onPaymentError` also fires
 * when that step fails, and remounting this element lets the customer try again.
 */
export function WhopCheckoutElement({
  planId,
  sessionId,
  returnUrl,
  environment,
  remountKey,
  onComplete,
  onPaymentError,
}: {
  planId: string;
  sessionId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  remountKey: number;
  onComplete: (planId: string, receiptId: string) => void;
  onPaymentError: (message: string) => void;
}) {
  const onCompleteRef = useRef(onComplete);
  const onPaymentErrorRef = useRef(onPaymentError);

  const completeName = `rlWhopCheckoutComplete${remountKey}`;
  const errorName = `rlWhopCheckoutPaymentError${remountKey}`;

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onPaymentErrorRef.current = onPaymentError;
  });

  useEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target[completeName] = (completedPlanId: string, receiptId: string) => {
      onCompleteRef.current(completedPlanId, receiptId);
    };
    target[errorName] = (error: PaymentError) => {
      onPaymentErrorRef.current(error?.message || "The card payment did not complete.");
    };

    const existing = document.querySelector<HTMLScriptElement>("script[data-whop-checkout-loader]");
    if (!existing) {
      const script = document.createElement("script");
      script.src = LOADER_SRC;
      script.async = true;
      script.defer = true;
      script.dataset.whopCheckoutLoader = "true";
      document.body.appendChild(script);
    }

    return () => {
      delete target[completeName];
      delete target[errorName];
    };
  }, [completeName, errorName]);

  return (
    <div
      id={`whop-embedded-checkout-${remountKey}`}
      data-whop-checkout-plan-id={planId}
      data-whop-checkout-session={sessionId}
      data-whop-checkout-return-url={returnUrl}
      data-whop-checkout-environment={environment}
      data-whop-checkout-theme="dark"
      data-whop-checkout-theme-accent-color="#d4af37"
      data-whop-checkout-theme-background-color="#12110e"
      data-whop-checkout-on-complete={completeName}
      data-whop-checkout-on-payment-error={errorName}
      data-whop-checkout-style-container-padding-x="0"
      data-whop-checkout-style-container-padding-top="8"
      data-whop-checkout-style-container-padding-bottom="8"
    />
  );
}
