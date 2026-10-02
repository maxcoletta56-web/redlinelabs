"use client";

import { useState } from "react";
import Link from "next/link";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { COMPANY_EMAIL } from "@/lib/company";
import { formatPrice } from "@/lib/products";

export type CardCheckoutSession = {
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  reference: string;
  totalCents: number;
};

export function BankTransferPending() {
  return (
    <p className="text-sm leading-6 text-[#8f8c84]" role="status">
      Creating your order and payment instructions.
    </p>
  );
}

export function CardCheckout({ session }: { session: CardCheckoutSession }) {
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const [remountKey, setRemountKey] = useState(0);
  const amount = formatPrice(session.totalCents / 100);

  if (complete) {
    return (
      <div className="space-y-3" role="status">
        <ClearCartOnSuccess />
        <p className="text-sm leading-6 text-[#cfc8b8]">
          Payment submitted for order {session.reference}. The confirmation email is sent when Whop
          confirms the charge of {amount} AUD.
        </p>
        <Link href={`/order/${session.reference}`} className="btn">
          View order
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Card checkout for {amount} AUD. The amount is the catalogue total
        {session.environment === "sandbox" ? " in the Whop sandbox." : "."} Your bank may ask for
        3D Secure or another confirmation step before the payment finishes.
      </p>
      {error && (
        <div className="space-y-3" role="alert">
          <p className="text-sm leading-6 text-[#d4af37]">{error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setError(null);
              setRemountKey((key) => key + 1);
            }}
          >
            Try the card again
          </button>
        </div>
      )}
      {!error && (
        <WhopCheckoutElement
          key={remountKey}
          planId={session.planId}
          sessionId={session.sessionId}
          returnUrl={session.returnUrl}
          environment={session.environment}
          remountKey={remountKey}
          onComplete={() => setComplete(true)}
          onPaymentError={(message) => setError(message)}
        />
      )}
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
