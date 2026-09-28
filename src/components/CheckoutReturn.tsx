"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import {
  clearWhopCheckoutResume,
  parseWhopCheckoutResume,
  readWhopCheckoutResumeRaw,
  subscribeWhopCheckoutResume,
  WhopCheckoutElement,
} from "@/components/WhopCheckoutElement";

export function CheckoutReturn({
  status,
  orderReference,
}: {
  status: string;
  orderReference: string;
}) {
  const [remounts, setRemounts] = useState(0);
  const succeeded = status === "success";
  const failed = status === "error";
  const raw = useSyncExternalStore(subscribeWhopCheckoutResume, readWhopCheckoutResumeRaw, () => null);
  const resume = useMemo(() => parseWhopCheckoutResume(raw), [raw]);
  const [reference, setReference] = useState(orderReference);
  const nextReference = orderReference || resume?.orderReference || reference;
  if (nextReference !== reference) setReference(nextReference);

  useEffect(() => {
    if (succeeded) clearWhopCheckoutResume();
  }, [succeeded]);

  if (succeeded) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <ClearCartOnSuccess />
        <p className="kicker mb-3">Paid</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Thank you</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The card payment returned as successful
          {reference ? ` for order ${reference}` : ""}. A confirmation email is sent when Whop
          confirms the payment. Dispatch follows that confirmation.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          {reference && (
            <Link href={`/order/${reference}`} className="btn">
              View order
            </Link>
          )}
          <Link href="/shop" className="btn-ghost">
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  if (failed && resume) {
    return (
      <div className="wrap max-w-[760px] py-16">
        <p className="kicker mb-3">Checkout</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Try the card again</h1>
        <p className="mb-6 text-sm leading-7 text-[#8f8c84]">
          The bank step did not finish, or the payment was canceled. Nothing is marked paid until
          Whop confirms it. The checkout below is the same order
          {reference ? ` ${reference}` : ""}.
        </p>
        <div className="surface overflow-hidden p-3">
          <WhopCheckoutElement key={remounts} {...resume} mountKey={remounts} />
        </div>
        <button type="button" className="btn-ghost mt-4" onClick={() => setRemounts((count) => count + 1)}>
          Remount checkout
        </button>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[700px] py-20 text-center">
      <p className="kicker mb-3">Checkout</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {failed ? "Payment not completed" : "Payment not confirmed"}
      </h1>
      <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
        {failed
          ? "The card payment did not finish. Return to checkout to start again. Nothing is marked paid until Whop confirms it."
          : "This page confirms a card payment after 3D Secure or another bank step. If you already paid, the order page updates when the confirmation arrives."}
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/checkout" className="btn">
          Return to checkout
        </Link>
        {reference && (
          <Link href={`/order/${reference}`} className="btn-ghost">
            View order
          </Link>
        )}
      </div>
    </div>
  );
}
