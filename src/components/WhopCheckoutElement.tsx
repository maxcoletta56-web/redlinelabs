"use client";

import { useEffect, useId, useRef } from "react";
import type { WhopEnvironment } from "@/lib/whop";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type CallbackWindow = Window & Record<string, unknown>;

/**
 * Whop's checkout element. The loader mounts an iframe inside this node.
 * `returnUrl` is where 3D Secure and other off-site steps send the buyer
 * back; `status` on that URL is `success` or `error`. `onPaymentError`
 * covers declines and 3DS failures that stay on this page, and remounting
 * the element lets the buyer try again.
 */
export function WhopCheckoutElement({
  sessionId,
  planId,
  returnUrl,
  environment,
  onComplete,
  onPaymentError,
}: {
  sessionId: string;
  planId: string | null;
  returnUrl: string;
  environment: WhopEnvironment;
  onComplete: () => void;
  onPaymentError: (message: string) => void;
}) {
  const reactId = useId().replace(/:/g, "");
  const completeName = `whopComplete${reactId}`;
  const errorName = `whopError${reactId}`;
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onPaymentError);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onErrorRef.current = onPaymentError;
  });

  useEffect(() => {
    const target = window as unknown as CallbackWindow;
    target[completeName] = () => {
      onCompleteRef.current();
    };
    target[errorName] = (error: { message?: string } | undefined) => {
      onErrorRef.current(error?.message?.trim() || "The card payment did not complete.");
    };

    const selector = `script[data-whop-loader="${reactId}"]`;
    document.querySelector(selector)?.remove();
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.whopLoader = reactId;
    document.body.appendChild(script);

    return () => {
      delete target[completeName];
      delete target[errorName];
      script.remove();
    };
  }, [completeName, errorName, reactId, sessionId]);

  return (
    <div
      className="min-h-[640px]"
      data-whop-checkout-session={sessionId}
      {...(planId ? { "data-whop-checkout-plan-id": planId } : {})}
      data-whop-checkout-return-url={returnUrl}
      data-whop-checkout-environment={environment}
      data-whop-checkout-theme="dark"
      data-whop-checkout-theme-accent-color="#d4af37"
      data-whop-checkout-skip-redirect="true"
      data-whop-checkout-on-complete={completeName}
      data-whop-checkout-on-payment-error={errorName}
    />
  );
}
