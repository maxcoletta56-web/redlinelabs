"use client";

import { useEffect, useId, useState } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type PaymentError = { message?: string; code?: string };

type Address = {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
};

/**
 * Whop's embedded checkout element. `returnUrl` is required so 3D Secure and
 * other redirect-based next actions can land back on this site. After that
 * redirect, `/checkout/complete` reads `status=success` or `status=error`.
 * `onPaymentError` covers declines and 3DS failures that stay in the element.
 * The element is not given a price; the session was priced on the server.
 */
export function WhopCheckoutElement({
  planId,
  sessionId,
  returnUrl,
  environment,
  email,
  address,
}: {
  planId: string;
  sessionId: string;
  returnUrl: string;
  environment: "sandbox" | "production";
  email?: string;
  address?: Address;
}) {
  const reactId = useId().replace(/:/g, "");
  const errorName = `rlWhopPaymentError_${reactId}`;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const target = window as unknown as Record<string, (paymentError: PaymentError) => void>;
    target[errorName] = (paymentError) => {
      const message = paymentError?.message?.trim() || "The card payment did not go through. You can try the card again.";
      setError(message);
    };

    const scriptId = "whop-checkout-loader";
    document.getElementById(scriptId)?.remove();
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = LOADER_SRC;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      delete target[errorName];
    };
  }, [errorName, planId, sessionId]);

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <div
        id={`whop-checkout-${reactId}`}
        data-whop-checkout-plan-id={planId}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#050505"
        data-whop-checkout-on-payment-error={errorName}
        {...(email
          ? {
              "data-whop-checkout-prefill-email": email,
              "data-whop-checkout-disable-email": "true",
            }
          : {})}
        {...(address
          ? {
              "data-whop-checkout-hide-address": "true",
              "data-whop-checkout-prefill-name": address.name,
              "data-whop-checkout-prefill-address-country": "AU",
              "data-whop-checkout-prefill-address-line1": address.line1,
              "data-whop-checkout-prefill-address-line2": address.line2 ?? "",
              "data-whop-checkout-prefill-address-city": address.city,
              "data-whop-checkout-prefill-address-state": address.state,
              "data-whop-checkout-prefill-address-postal-code": address.postalCode,
            }
          : {})}
      />
      {environment === "sandbox" && (
        <p className="text-xs leading-5 text-[#8f8c84]">
          Sandbox card checkout. Use 4242 4242 4242 4242 for a successful payment, 4000 0000
          0000 0002 for a decline, or 5385 3083 6013 5181 when the bank asks for 3D Secure
          (password Checkout1!). Any future expiry and any CVC work. Nothing is charged.
        </p>
      )}
    </div>
  );
}
