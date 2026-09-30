"use client";

import { useEffect, useState } from "react";
import type { ShippingAddressInput } from "@/lib/checkout-session";

type PaymentError = { message?: string; code?: string };

type WhopWindow = Window & {
  rlWhopOnPaymentError?: (error: PaymentError) => void;
};

/**
 * Whop's embedded Checkout Element. Card collection stays on this page.
 * 3D Secure and other redirect next actions leave through `returnUrl` and
 * come back with `?status=success` or `?status=error`. A decline stays in
 * the element; the callback only surfaces the message. Remounting is the
 * documented retry after `status=error` or when the customer asks to try again.
 */
export function WhopCheckoutElement({
  planId,
  sessionId,
  returnUrl,
  environment,
  email,
  shipping,
}: {
  planId: string;
  sessionId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  email: string;
  shipping?: ShippingAddressInput | null;
}) {
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    const target = window as WhopWindow;
    target.rlWhopOnPaymentError = (error) => {
      const message = error?.message?.trim() || "The card payment did not complete.";
      setPaymentError(message);
    };
    return () => {
      if (target.rlWhopOnPaymentError) delete target.rlWhopOnPaymentError;
    };
  }, []);

  const name = shipping?.name?.trim() ?? "";

  return (
    <div className="space-y-3">
      {environment === "sandbox" && (
        <p className="text-xs leading-6 text-[#8f8c84]">
          Sandbox card checkout. Use a future expiry and any CVC.{" "}
          <span className="text-[#cfc8b8]">4242 4242 4242 4242</span> succeeds,{" "}
          <span className="text-[#cfc8b8]">4000 0000 0000 0002</span> declines, and{" "}
          <span className="text-[#cfc8b8]">5385 3083 6013 5181</span> asks for 3D Secure
          (password <span className="text-[#cfc8b8]">Checkout1!</span>).
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
              setGeneration((current) => current + 1);
            }}
          >
            Try the card again
          </button>
        </div>
      )}
      <div
        key={`${sessionId}-${generation}`}
        id="whop-embedded-checkout"
        data-whop-checkout-plan-id={planId}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#0b0b0b"
        data-whop-checkout-hide-price="true"
        data-whop-checkout-prefill-email={email}
        data-whop-checkout-prefill-name={name}
        data-whop-checkout-prefill-address-name={name}
        data-whop-checkout-prefill-address-country={shipping?.country || "AU"}
        data-whop-checkout-prefill-address-line1={shipping?.line1 ?? ""}
        data-whop-checkout-prefill-address-line2={shipping?.line2 ?? ""}
        data-whop-checkout-prefill-address-city={shipping?.city ?? ""}
        data-whop-checkout-prefill-address-state={shipping?.state ?? ""}
        data-whop-checkout-prefill-address-postal-code={shipping?.postal_code ?? ""}
        data-whop-checkout-on-payment-error="rlWhopOnPaymentError"
        data-whop-checkout-style-container-padding-x="0"
        data-whop-checkout-style-container-padding-top="0"
        className="min-h-[32rem] w-full"
      />
    </div>
  );
}
