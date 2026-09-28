"use client";

import { useEffect, useId, useState } from "react";
import type { WhopEnvironmentName } from "@/lib/whop-environment";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";
const STORAGE_KEY = "rl-whop-checkout";
const resumeListeners = new Set<() => void>();

function emitWhopCheckoutResume() {
  for (const listener of resumeListeners) listener();
}

export function subscribeWhopCheckoutResume(listener: () => void) {
  resumeListeners.add(listener);
  return () => {
    resumeListeners.delete(listener);
  };
}

export type WhopCheckoutResume = {
  sessionId: string;
  planId: string;
  environment: WhopEnvironmentName;
  orderReference: string;
  email: string;
  returnUrl: string;
};

export function saveWhopCheckoutResume(value: WhopCheckoutResume) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  emitWhopCheckoutResume();
}

export function readWhopCheckoutResumeRaw() {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function parseWhopCheckoutResume(raw: string | null): WhopCheckoutResume | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WhopCheckoutResume;
    if (!parsed?.sessionId || !parsed.planId || !parsed.returnUrl) return null;
    if (parsed.environment !== "sandbox" && parsed.environment !== "production") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function readWhopCheckoutResume(): WhopCheckoutResume | null {
  return parseWhopCheckoutResume(readWhopCheckoutResumeRaw());
}

export function clearWhopCheckoutResume() {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
  emitWhopCheckoutResume();
}

/**
 * Mounts Whop's embedded checkout element. returnUrl is required so 3D Secure
 * and other off-site next actions can land back here. status=error remounts
 * the element; status=success is only a receipt screen. The webhook marks the
 * order paid.
 */
export function WhopCheckoutElement({
  sessionId,
  planId,
  environment,
  returnUrl,
  email,
  orderReference,
  mountKey = 0,
}: WhopCheckoutResume & { mountKey?: number }) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `whop-checkout-${reactId}-${mountKey}`;
  const [error, setError] = useState<string | null>(null);
  const callbackName = `rlWhopPaymentError_${reactId}_${mountKey}`;

  useEffect(() => {
    saveWhopCheckoutResume({ sessionId, planId, environment, returnUrl, email, orderReference });
    const windowRecord = window as unknown as Record<string, (reason: { message?: string }) => void>;
    windowRecord[callbackName] = (reason) => {
      setError(reason?.message || "The card payment did not complete. You can try again.");
    };
    const script = document.createElement("script");
    script.src = LOADER_SRC;
    script.async = true;
    script.dataset.whopCheckoutLoader = elementId;
    document.body.appendChild(script);
    return () => {
      delete windowRecord[callbackName];
      script.remove();
    };
  }, [callbackName, elementId, email, environment, orderReference, planId, returnUrl, sessionId]);

  return (
    <div className="space-y-3">
      {environment === "sandbox" && (
        <p className="text-xs leading-5 text-[#8f8c84]">
          Sandbox checkout. Test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 declines,
          and 5385 3083 6013 5181 asks for 3D Secure. Use any future expiry and any CVC.
        </p>
      )}
      <div
        id={elementId}
        data-whop-checkout-session={sessionId}
        data-whop-checkout-plan-id={planId}
        data-whop-checkout-return-url={returnUrl}
        data-whop-checkout-environment={environment}
        data-whop-checkout-theme="dark"
        data-whop-checkout-theme-accent-color="#d4af37"
        data-whop-checkout-theme-background-color="#14120e"
        data-whop-checkout-prefill-email={email}
        data-whop-checkout-disable-email="true"
        data-whop-checkout-hide-address="true"
        data-whop-checkout-on-payment-error={callbackName}
      />
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error} If your bank sent you away from this page, use the return link to try the card
          again.
        </p>
      )}
    </div>
  );
}
