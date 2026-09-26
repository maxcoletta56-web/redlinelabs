"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import type { CartLineInput } from "@/lib/order";
import { readNextAction, type NextActionView } from "@/lib/whop-next-action";
import { formatPrice } from "@/lib/products";
import { WhopNextAction } from "@/components/WhopNextAction";

const LOADER_SRC = "https://js.whop.com/static/checkout/loader.js";

type SessionResponse = {
  orderId: string;
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  amountCents: number;
  returnUrl: string;
  error?: string;
};

type CheckoutProps = {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
};

declare global {
  interface Window {
    __rlWhopComplete?: (planId: string, receiptId: string, result?: unknown) => void;
    __rlWhopPaymentError?: (error: { message?: string; code?: string }) => void;
  }
}

export function WhopCardCheckout(props: CheckoutProps) {
  const router = useRouter();
  const [session, setSession] = useState<SessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mountKey, setMountKey] = useState(0);
  const [nextAction, setNextAction] = useState<NextActionView | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout/whop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: props.items,
        email: props.email,
        firstName: props.firstName,
        lastName: props.lastName,
        shipping: props.shipping ?? null,
        promoCode: props.promoCode ?? null,
        ageConfirmed: props.ageConfirmed,
        researchUse: props.researchUse,
      }),
    })
      .then(async (response) => {
        const data = (await response.json()) as SessionResponse;
        if (!response.ok) throw new Error(data.error || "Whop checkout failed");
        return data;
      })
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(reason instanceof Error ? reason.message : "Whop checkout failed");
      });
    return () => {
      cancelled = true;
    };
  }, [props.items, props.email, props.firstName, props.lastName, props.shipping, props.promoCode, props.ageConfirmed, props.researchUse]);

  useEffect(() => {
    if (!session) return;
    window.__rlWhopComplete = (_planId, _receiptId, result) => {
      const record = result && typeof result === "object" ? (result as { next_action?: unknown }) : null;
      const action = readNextAction(record?.next_action);
      if (action?.kind === "redirect" && action.mode === "full_page") {
        window.location.assign(action.url);
        return;
      }
      if (action) {
        setNextAction(action);
        return;
      }
      router.push(`/checkout/return?orderId=${encodeURIComponent(session.orderId)}&status=success`);
    };
    window.__rlWhopPaymentError = (paymentError) => {
      setError(paymentError?.message || "The card payment did not finish. You can try again.");
      setNextAction(null);
      setMountKey((value) => value + 1);
    };
    const script = document.createElement("script");
    script.src = `${LOADER_SRC}?mount=${mountKey}`;
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      script.remove();
      delete window.__rlWhopComplete;
      delete window.__rlWhopPaymentError;
    };
  }, [session, mountKey, router]);

  if (error && !session) {
    return (
      <p className="text-sm leading-6 text-[#d4af37]" role="alert">
        {error}
      </p>
    );
  }

  if (!session) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing the card form.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Card payment of {formatPrice(session.amountCents / 100)} AUD stays on this page.
        {session.environment === "sandbox"
          ? " Sandbox test cards: 4242 4242 4242 4242 succeeds, 4000 0000 0000 0002 is declined, and 5385 3083 6013 5181 asks for 3D Secure with Checkout1!."
          : ""}
      </p>
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      {nextAction ? (
        <WhopNextAction action={nextAction} />
      ) : (
        <div
          key={mountKey}
          id={`whop-checkout-${mountKey}`}
          data-whop-checkout-plan-id={session.planId}
          data-whop-checkout-session={session.sessionId}
          data-whop-checkout-environment={session.environment}
          data-whop-checkout-return-url={session.returnUrl}
          data-whop-checkout-theme="dark"
          data-whop-checkout-theme-accent-color="#d4af37"
          data-whop-checkout-theme-background-color="#0b0b0b"
          data-whop-checkout-prefill-email={props.email}
          data-whop-checkout-on-complete="__rlWhopComplete"
          data-whop-checkout-on-payment-error="__rlWhopPaymentError"
          className="min-h-[280px]"
        />
      )}
    </div>
  );
}
