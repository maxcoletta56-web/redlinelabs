"use client";

import Link from "next/link";
import { useState } from "react";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import {
  PaymentMethodChoice,
  useCheckoutAvailability,
  useSelectedPaymentMethod,
} from "@/components/PaymentMethodChoice";
import { WhopCardCheckout } from "@/components/WhopCardCheckout";
import type { WhopEmbedSession } from "@/lib/whop-session";
import { useAccount } from "@/lib/account";
import { MEMBERSHIP_PRICE_CENTS, MEMBERSHIP_SLUG } from "@/lib/membership";
import { formatPrice } from "@/lib/products";

/**
 * Pay the one-time sign-up fee from an account that already exists in this
 * browser. The fee uses the same PayID and PayPal rails as a normal order.
 */
export function ClubJoinForm() {
  const { user, hydrated } = useAccount();
  const availability = useCheckoutAvailability();
  const { method, choose } = useSelectedPaymentMethod(availability.showChoice, availability.methods);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cardSession, setCardSession] = useState<WhopEmbedSession | null>(null);
  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);

  if (!hydrated) {
    return <p className="text-sm text-[#8f8c84]">Loading your account…</p>;
  }

  if (!user) {
    return (
      <div className="surface p-6">
        <p className="text-sm leading-7 text-[#cfc8b8]">
          Create an account or log in to join. The sign-up fee is {price}, once.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/account?mode=signup&next=/club" className="btn">
            Create account
          </Link>
          <Link href="/account?mode=login&next=/club" className="btn-ghost">
            Log in
          </Link>
        </div>
      </div>
    );
  }

  const paymentMethod = availability.showChoice ? method : availability.defaultMethod;

  if (cardSession) {
    return (
      <div className="surface space-y-4 p-6">
        <WhopCardCheckout session={cardSession} />
      </div>
    );
  }

  return (
    <form
      className="surface space-y-4 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (pending) return;
        const form = new FormData(event.currentTarget);
        if (form.get("ageConfirmed") !== "on" || form.get("researchUse") !== "on") {
          setError("Age and research-use confirmation are required");
          return;
        }
        setPending(true);
        setError(null);
        startCartCheckoutSession({
          items: [{ slug: MEMBERSHIP_SLUG, qty: 1 }],
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          shipping: {
            name: `${user.firstName} ${user.lastName}`.trim(),
            line1: "Club sign-up — no delivery",
            line2: "",
            city: "Sydney",
            state: "NSW",
            postal_code: "2000",
            country: "AU",
          },
          paymentMethod,
          ageConfirmed: true,
          researchUse: true,
        })
          .then((result) => {
            if (result.ok && result.whop) {
              setCardSession(result.whop);
              setPending(false);
              return;
            }
            if (result.ok && result.redirectUrl) {
              window.location.assign(result.redirectUrl);
              return;
            }
            setError(result.error);
            setPending(false);
          })
          .catch(() => {
            setError("Checkout could not be started. Nothing has been charged.");
            setPending(false);
          });
      }}
    >
      <p className="text-sm leading-6 text-[#cfc8b8]">
        Join as <span className="text-white">{user.email}</span>. Pay {price} once. Nothing is
        shipped.
      </p>
      {availability.showChoice && (
        <PaymentMethodChoice methods={availability.methods} value={paymentMethod} onChange={choose} />
      )}
      <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
        <input name="ageConfirmed" type="checkbox" className="mt-1" />
        <span>I am 18 or older.</span>
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
        <input name="researchUse" type="checkbox" className="mt-1" />
        <span>I am buying for laboratory research use only.</span>
      </label>
      {error && (
        <p className="text-xs leading-5 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn w-full" disabled={pending} aria-busy={pending}>
        {pending ? "Starting checkout…" : `Join — ${price}`}
      </button>
    </form>
  );
}
