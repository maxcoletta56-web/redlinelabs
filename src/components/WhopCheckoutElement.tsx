"use client";

import { useEffect, useId, useState } from "react";
import type { WhopEmbedSession } from "@/lib/whop-embed";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

/**
 * Whop's embedded Checkout Element. The loader mounts the iframe.
 * 3D Secure and other off-site steps leave this page and come back to
 * `returnUrl` with `payment` and `status`. The order is not marked paid here.
 */
export function WhopCheckoutElement({ session }: { session: WhopEmbedSession }) {
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const callbackName = `rlWhopPaymentError${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const host = window as unknown as Record<string, (error?: { message?: string }) => void>;
    host[callbackName] = (error) => {
      setPaymentError(
        error?.message ||
          "The card payment did not go through. If a bank or 3D Secure step was cancelled, you can try again.",
      );
    };
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.dataset.rlWhopLoader = session.sessionId;
    document.body.appendChild(script);
    return () => {
      delete host[callbackName];
      script.remove();
    };
  }, [callbackName, session.sessionId]);

  const address = session.address;
  return (
    <div className="space-y-3">
      {session.environment === "sandbox" && (
        <p className="text-xs leading-5 text-[#8f8c84]">
          Sandbox mode. A successful test card is 4242 4242 4242 4242. A declined card is 4000
          0000 0000 0002. 3D Secure uses 5385 3083 6013 5181 and the password Checkout1!. Any
          future expiry and any CVC work. Nothing is charged.
        </p>
      )}
      {paymentError && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {paymentError}
        </p>
      )}
      <div
        id="whop-embedded-checkout"
        data-whop-checkout-plan-id={session.planId}
        data-whop-checkout-session={session.sessionId}
        data-whop-checkout-return-url={session.returnUrl}
        data-whop-checkout-environment={session.environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#050505"
        data-whop-checkout-prefill-email={session.email}
        data-whop-checkout-prefill-name={address.name}
        data-whop-checkout-prefill-address-country={address.country}
        data-whop-checkout-prefill-address-line1={address.line1}
        data-whop-checkout-prefill-address-line2={address.line2}
        data-whop-checkout-prefill-address-city={address.city}
        data-whop-checkout-prefill-address-state={address.state}
        data-whop-checkout-prefill-address-postal-code={address.postalCode}
        data-whop-checkout-on-payment-error={callbackName}
        className="min-h-[640px]"
      />
      <p className="text-xs leading-5 text-[#8f8c84]">
        Card details stay inside Whop. A bank or 3D Secure check may leave this page and return
        with a status. The order is marked paid only after Whop confirms the payment.
      </p>
    </div>
  );
}
