"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import type { WhopEnvironment } from "@/lib/whop";
import { withTimeout } from "@/lib/with-timeout";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";

const SUBMIT_TIMEOUT_MS = 25_000;

const SANDBOX_CARDS = [
  ["4242 4242 4242 4242", "Successful payment"],
  ["4000 0000 0000 0002", "Declined payment"],
  ["5385 3083 6013 5181", "3D Secure — password Checkout1!"],
] as const;

type Session = {
  sessionId: string;
  planId: string | null;
  environment: WhopEnvironment;
  reference: string;
  returnUrl: string;
};

export function WhopCardCheckout({
  items,
  email,
  firstName,
  lastName,
  shipping,
  promoCode,
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<{ key: string; message: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{ key: string; data: Session } | null>(null);
  const [embedKey, setEmbedKey] = useState(0);
  const requestKey = useMemo(
    () =>
      JSON.stringify({
        attempt,
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        ageConfirmed,
        researchUse,
      }),
    [attempt, items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse],
  );

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      startWhopCardCheckout({
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        ageConfirmed,
        researchUse,
      }),
      SUBMIT_TIMEOUT_MS,
      "Checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setError({ key: requestKey, message: result.error });
          return;
        }
        setError(null);
        setSession({
          key: requestKey,
          data: {
            sessionId: result.sessionId,
            planId: result.planId,
            environment: result.environment,
            reference: result.reference,
            returnUrl: result.returnUrl,
          },
        });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError({
          key: requestKey,
          message:
            reason instanceof Error && reason.name === "TimeoutError"
              ? "Checkout is taking longer than expected. Nothing has been charged."
              : "Checkout could not be started. Nothing has been charged.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [
    requestKey,
    items,
    email,
    firstName,
    lastName,
    shipping,
    promoCode,
    ageConfirmed,
    researchUse,
  ]);

  const active = session?.key === requestKey ? session.data : null;
  const activeError = error?.key === requestKey ? error.message : null;

  if (activeError && !active) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm leading-6 text-[#d4af37]">{activeError}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null);
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!active) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing the card checkout.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {active.environment === "sandbox" && (
        <div className="text-xs leading-6 text-[#8f8c84]" role="note">
          <p>Sandbox test cards. Use any future expiry and any CVC.</p>
          <ul className="mt-1 space-y-1">
            {SANDBOX_CARDS.map(([number, label]) => (
              <li key={number}>
                <span className="text-[#d4af37]">{number}</span> — {label}
              </li>
            ))}
          </ul>
        </div>
      )}
      {activeError && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {activeError} The card form has been reloaded so you can try again.
        </p>
      )}
      <WhopCheckoutElement
        key={`${active.sessionId}-${embedKey}`}
        sessionId={active.sessionId}
        planId={active.planId}
        returnUrl={active.returnUrl}
        environment={active.environment}
        onComplete={() => {
          const destination = new URL(active.returnUrl);
          router.push(`${destination.pathname}?status=success`);
        }}
        onPaymentError={(message) => {
          setError({ key: requestKey, message });
          setEmbedKey((value) => value + 1);
        }}
      />
      <p className="text-xs leading-6 text-[#8f8c84]">
        Having trouble? Email{" "}
        <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
          {COMPANY_EMAIL}
        </a>
        .
      </p>
    </div>
  );
}
