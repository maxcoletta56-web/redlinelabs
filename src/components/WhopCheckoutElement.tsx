"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import type { WhopEnvironment } from "@/lib/whop-config";

type PaymentError = { message?: string; code?: string };

declare global {
  interface Window {
    redlineWhopPaymentError?: (error: PaymentError) => void;
  }
}

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

export function WhopCheckoutElement({
  planId,
  sessionId,
  returnUrl,
  environment,
  email,
  mountKey,
  onPaymentError,
}: {
  planId: string;
  sessionId: string;
  returnUrl: string;
  environment: WhopEnvironment;
  email: string;
  mountKey: number;
  onPaymentError: (message: string) => void;
}) {
  const onError = useRef(onPaymentError);
  useEffect(() => {
    onError.current = onPaymentError;
  }, [onPaymentError]);

  useEffect(() => {
    window.redlineWhopPaymentError = (error) => {
      const message = error?.message?.trim() || "The card payment did not complete.";
      onError.current(message);
    };
    return () => {
      delete window.redlineWhopPaymentError;
    };
  }, [mountKey]);

  return (
    <div className="min-h-[420px]">
      <Script src={LOADER_SRC} strategy="afterInteractive" />
      <div
        key={mountKey}
        id="whop-embedded-checkout"
        data-whop-checkout-plan-id={planId}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#0b0b0b"
        data-whop-checkout-prefill-email={email}
        data-whop-checkout-disable-email="true"
        data-whop-checkout-on-payment-error="redlineWhopPaymentError"
        data-whop-checkout-style-container-padding-x="0"
        data-whop-checkout-style-container-padding-top="0"
      />
    </div>
  );
}
