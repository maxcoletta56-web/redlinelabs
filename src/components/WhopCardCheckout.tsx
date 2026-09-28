"use client";

import { useEffect, useId, useState } from "react";
import type { WhopEmbeddedCheckout } from "@/lib/whop-session";

type WhopLoader = {
  setEmail?: (elementId: string, email: string) => Promise<unknown>;
};

declare global {
  interface Window {
    wco?: WhopLoader;
  }
}

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

/**
 * Mounts Whop's embedded checkout element for a server-created session.
 * 3D Secure and other full-page next actions return to `returnUrl` with
 * `status=success` or `status=error`. Declines and 3DS failures also call
 * the payment-error callback so the buyer can try again without leaving.
 */
export function WhopCardCheckout({
  checkout,
  email,
}: {
  checkout: WhopEmbeddedCheckout;
  email: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `whop-checkout-${reactId}`;
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    const node = document.getElementById(elementId);
    if (!node) return;
    const completeName = `rlWhopComplete_${reactId}`;
    const errorName = `rlWhopError_${reactId}`;
    const callbacks = window as unknown as Record<string, unknown>;
    callbacks[completeName] = () => {
      const url = new URL(checkout.returnUrl);
      url.searchParams.set("status", "success");
      window.location.assign(url.toString());
    };
    callbacks[errorName] = (error: { message?: string } | undefined) => {
      setPaymentError(error?.message || "The card payment did not go through. Nothing else was charged.");
    };
    node.setAttribute("data-whop-checkout-on-complete", completeName);
    node.setAttribute("data-whop-checkout-on-payment-error", errorName);

    let script = document.querySelector<HTMLScriptElement>(`script[src="${LOADER_SRC}"]`);
    if (!script) {
      script = document.createElement("script");
      script.src = LOADER_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    const applyEmail = () => {
      if (!email || !window.wco?.setEmail) return;
      void window.wco.setEmail(elementId, email);
    };
    script.addEventListener("load", applyEmail);
    applyEmail();

    return () => {
      script?.removeEventListener("load", applyEmail);
      delete callbacks[completeName];
      delete callbacks[errorName];
    };
  }, [checkout.returnUrl, elementId, email, reactId, mountKey]);

  return (
    <div className="space-y-3">
      {checkout.environment === "sandbox" && (
        <p className="text-xs leading-6 text-[#8f8c84]">
          Sandbox card checkout. Use 4242 4242 4242 4242 for a successful payment, 4000 0000
          0000 0002 for a decline, or 5385 3083 6013 5181 when you need to pass 3D Secure
          (password Checkout1!). Any future expiry and any CVC work.
        </p>
      )}
      {paymentError && (
        <div role="alert" className="space-y-3">
          <p className="text-sm leading-6 text-[#d4af37]">{paymentError}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPaymentError(null);
              setMountKey((key) => key + 1);
            }}
          >
            Try the card again
          </button>
        </div>
      )}
      <div
        key={mountKey}
        id={elementId}
        className="min-h-[640px] w-full"
        data-whop-checkout-plan-id={checkout.planId}
        data-whop-checkout-session={checkout.sessionId}
        data-whop-checkout-return-url={checkout.returnUrl}
        data-whop-checkout-environment={checkout.environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-email={email}
      />
    </div>
  );
}
