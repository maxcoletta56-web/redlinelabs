"use client";

import { useLayoutEffect, useState } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type PaymentError = { message?: string; code?: string };

/**
 * Whop's embedded checkout element. 3D Secure and other off-site steps return
 * to `returnUrl` with `status=success` or `status=error`. A processing failure
 * also fires the payment-error callback so the element can be remounted.
 */
export function WhopCardCheckout({
  sessionId,
  environment,
  returnUrl,
  email,
  onComplete,
  onPaymentError,
}: {
  sessionId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  email: string;
  onComplete: (planId: string, receiptId?: string) => void;
  onPaymentError: (error: PaymentError) => void;
}) {
  const [mount, setMount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const completeName = `rlWhopComplete${mount}`;
  const errorName = `rlWhopError${mount}`;

  useLayoutEffect(() => {
    const target = window as unknown as Record<string, unknown>;
    target[completeName] = (planId: string, receiptId?: string) => {
      onComplete(planId, receiptId);
    };
    target[errorName] = (paymentError: PaymentError) => {
      const message = paymentError?.message || "The card payment did not complete";
      setError(message);
      onPaymentError(paymentError ?? {});
    };
    if (!document.querySelector("script[data-whop-checkout-loader]")) {
      const script = document.createElement("script");
      script.src = LOADER_SRC;
      script.async = true;
      script.dataset.whopCheckoutLoader = "true";
      document.body.appendChild(script);
    }
    return () => {
      delete target[completeName];
      delete target[errorName];
    };
  }, [completeName, errorName, onComplete, onPaymentError]);

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => {
              setError(null);
              setMount((value) => value + 1);
            }}
          >
            Try the card again
          </button>
        </p>
      )}
      <div
        key={`${sessionId}-${mount}`}
        id={`whop-checkout-${mount}`}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-environment={environment}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-theme="dark"
        data-whop-checkout-prefill-email={email}
        data-whop-checkout-on-complete={completeName}
        data-whop-checkout-on-payment-error={errorName}
        style={{ minHeight: 420 }}
      />
    </div>
  );
}
