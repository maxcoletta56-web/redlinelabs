"use client";

import Link from "next/link";
import { useState } from "react";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import {
  WhopCheckoutElement,
  readWhopSession,
  type WhopEmbedSession,
} from "@/components/WhopCardCheckout";
import { COMPANY_EMAIL } from "@/lib/company";

function isErrorStatus(status: string) {
  return status === "error" || status === "failed" || status === "cancel" || status === "canceled";
}

function isSuccessStatus(status: string) {
  return status === "success" || status === "succeeded" || status === "complete";
}

/**
 * Whop sends the browser here after 3D Secure or another off-site next action.
 * `status=success` shows the receipt state. `status=error` remounts the embed
 * so the customer can try the card again. The webhook, not this page, marks
 * the order paid.
 */
export function WhopCheckoutReturn({
  reference,
  status,
}: {
  reference: string;
  status: string;
}) {
  const [embedKey, setEmbedKey] = useState(0);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [session, setSession] = useState<WhopEmbedSession | null>(null);
  const [missingSession, setMissingSession] = useState(false);
  const normalized = status.trim().toLowerCase();
  const failed = isErrorStatus(normalized);
  const succeeded = isSuccessStatus(normalized);

  function tryCardAgain() {
    const stored = readWhopSession(reference);
    if (!stored) {
      setMissingSession(true);
      return;
    }
    setMissingSession(false);
    setPaymentError(null);
    setSession(stored);
    setEmbedKey((key) => key + 1);
  }

  return (
    <div className="space-y-4">
      {succeeded ? <ClearCartOnSuccess /> : null}
      <p className="text-sm leading-7 text-[#8f8c84]" role="status">
        {succeeded
          ? "Your card issuer finished the verification step. A confirmation email is sent when the payment clears. The order page shows the latest status."
          : failed
            ? "The card payment did not finish. You can try the same checkout again, or start a new one."
            : "If your bank asked you to verify the card, finish that step in the checkout window. This page updates after you return."}
      </p>
      {paymentError ? (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {paymentError}
        </p>
      ) : null}
      {failed ? (
        <div className="space-y-3">
          <button type="button" className="btn" onClick={tryCardAgain}>
            Try the card again
          </button>
          {missingSession ? (
            <p className="text-sm leading-6 text-[#d4af37]" role="status">
              This browser no longer has the card form. Start checkout again.
            </p>
          ) : null}
          {session ? (
            <WhopCheckoutElement
              session={session}
              embedKey={embedKey}
              onPaymentError={(message) => setPaymentError(message)}
            />
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link href={`/order/${reference}`} className="btn">
          View order
        </Link>
        <Link href="/checkout" className="btn-ghost">
          Back to checkout
        </Link>
      </div>
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
