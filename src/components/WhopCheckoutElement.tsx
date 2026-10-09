"use client";

import { useEffect, useId } from "react";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

/**
 * Whop's embedded Checkout Element. The loader mounts an iframe from
 * `data-whop-checkout-session`. `returnUrl` is how an off-site step such as
 * 3D Secure comes back to this site; the page there reads `status` before
 * treating the visit as a sale. Card data never touches this app.
 */
export function WhopCheckoutElement({
  sessionId,
  planId,
  returnUrl,
  environment,
  email,
}: {
  sessionId: string;
  planId?: string | null;
  returnUrl: string;
  environment: "sandbox" | "production";
  email?: string;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `whop-checkout-${reactId}`;

  useEffect(() => {
    if (document.querySelector(`script[src="${LOADER_SRC}"]`)) return;
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  }, []);

  return (
    <div className="min-h-[560px] overflow-hidden bg-[#0b0b0b]">
      <div
        id={elementId}
        data-whop-checkout-session={sessionId}
        {...(planId ? { "data-whop-checkout-plan-id": planId } : {})}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        {...(email ? { "data-whop-checkout-prefill-email": email } : {})}
      />
      <p className="px-1 pt-3 text-xs leading-5 text-[#8f8c84]">
        {environment === "sandbox"
          ? "Sandbox card checkout. Use 4242 4242 4242 4242, any future expiry, and any CVC. A bank verification step returns you to this order."
          : "Your bank may ask you to verify this payment. That step returns you to this order."}
      </p>
    </div>
  );
}
