"use client";

import { useState } from "react";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import { CartCheckout } from "@/components/CartCheckout";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { formatPrice } from "@/lib/products";
import type { WhopEnvironmentName } from "@/lib/whop-environment";

export function CheckoutPayment({
  items,
  email,
  firstName,
  lastName,
  shipping,
  promoCode,
  ageConfirmed,
  researchUse,
  bankTransferConfigured,
  cardConfigured,
  cardEnvironment,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
  bankTransferConfigured: boolean;
  cardConfigured: boolean;
  cardEnvironment: WhopEnvironmentName;
}) {
  const [method, setMethod] = useState<"card" | "bank_transfer">(
    cardConfigured ? "card" : "bank_transfer",
  );
  const [session, setSession] = useState<{
    sessionId: string;
    planId: string;
    environment: WhopEnvironmentName;
    returnUrl: string;
    orderReference: string;
    totalCents: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bankStarted, setBankStarted] = useState(false);
  const showChoice = cardConfigured && bankTransferConfigured;

  async function startCard() {
    setError(null);
    setSubmitting(true);
    try {
      const result = await startWhopCardCheckout({
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        ageConfirmed,
        researchUse,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSession({
        sessionId: result.checkout.sessionId,
        planId: result.checkout.planId,
        environment: result.checkout.environment,
        returnUrl: result.checkout.returnUrl,
        orderReference: result.checkout.reference,
        totalCents: result.checkout.totalCents,
      });
    } catch (reason) {
      console.error("whop checkout failed", reason);
      setError("The card checkout did not start. Nothing has been charged.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Paying as {email}. Card details stay in Whop&apos;s checkout. A bank transfer shows PayID
        instructions on the next screen.
        {promoCode ? " The coupon is included in the amount calculated on the server." : ""}
      </p>
      {showChoice && !session && !bankStarted && (
        <fieldset>
          <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
            Payment method
          </legend>
          <div className="space-y-2">
            <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1"
                checked={method === "card"}
                onChange={() => setMethod("card")}
              />
              <span>
                <span className="block font-medium text-white">Card</span>
                <span className="text-[#8f8c84]">Pay on this page with Whop. 3D Secure opens if your bank asks for it.</span>
              </span>
            </label>
            <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
              <input
                type="radio"
                name="paymentMethod"
                className="mt-1"
                checked={method === "bank_transfer"}
                onChange={() => setMethod("bank_transfer")}
              />
              <span>
                <span className="block font-medium text-white">Bank transfer or PayID</span>
                <span className="text-[#8f8c84]">The next screen shows the amount and the reference to quote.</span>
              </span>
            </label>
          </div>
        </fieldset>
      )}
      {method === "card" && cardConfigured && !session && (
        <button type="button" className="btn" disabled={submitting} onClick={() => void startCard()}>
          {submitting ? "Preparing card checkout" : "Continue to card payment"}
        </button>
      )}
      {session && (
        <div className="surface overflow-hidden p-3">
          <p className="mb-3 text-sm text-[#cfc8b8]">
            Card charge {formatPrice(session.totalCents / 100)} AUD for order {session.orderReference}.
            This amount was calculated on the server.
          </p>
          <WhopCheckoutElement
            sessionId={session.sessionId}
            planId={session.planId}
            environment={session.environment}
            returnUrl={session.returnUrl}
            email={email}
            orderReference={session.orderReference}
          />
        </div>
      )}
      {method === "bank_transfer" && bankTransferConfigured && !bankStarted && !session && (
        <button type="button" className="btn" onClick={() => setBankStarted(true)}>
          Continue to bank transfer
        </button>
      )}
      {bankStarted && (
        <div className="surface overflow-hidden p-3">
          <CartCheckout
            items={items}
            email={email}
            firstName={firstName}
            lastName={lastName}
            shipping={shipping}
            promoCode={promoCode}
            ageConfirmed={ageConfirmed}
            researchUse={researchUse}
          />
        </div>
      )}
      {!cardConfigured && !bankTransferConfigured && (
        <p className="text-sm leading-6 text-[#d4af37]" role="status">
          Checkout is not configured.
        </p>
      )}
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error} Email{" "}
          <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
            {COMPANY_EMAIL}
          </a>{" "}
          if it keeps happening.
        </p>
      )}
      {cardEnvironment === "sandbox" && method === "card" && cardConfigured && !session && (
        <p className="text-xs leading-5 text-[#8f8c84]">Card checkout is in Whop sandbox.</p>
      )}
    </div>
  );
}
