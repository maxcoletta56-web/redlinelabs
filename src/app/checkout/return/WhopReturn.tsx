"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { resumeWhopCardCheckout } from "@/app/actions/checkout";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import type { WhopEmbedSession } from "@/lib/whop-embed";

const SUCCESS = new Set(["success", "succeeded"]);
const FAILED = new Set(["error", "failed", "canceled", "cancelled"]);

export function WhopReturn({
  reference,
  status,
}: {
  reference: string;
  status: string | null;
}) {
  const succeeded = status !== null && SUCCESS.has(status);
  const failed = status !== null && FAILED.has(status);
  const [embed, setEmbed] = useState<WhopEmbedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(failed);

  useEffect(() => {
    if (!failed) return;
    let cancelled = false;
    resumeWhopCardCheckout(reference)
      .then((result) => {
        if (cancelled) return;
        if (result.ok) setEmbed(result.embed);
        else setError(result.error);
      })
      .catch(() => {
        if (!cancelled) setError("Card checkout did not start. Nothing has been charged.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [failed, reference]);

  if (succeeded) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <ClearCartOnSuccess />
        <p className="kicker mb-3">Card</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
          Payment submitted
        </h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The card step finished, including any bank or 3D Secure check. This page does not
          mark the order paid. A confirmation email is sent when Whop confirms the payment.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href={`/order/${reference}`} className="btn">
            View order {reference}
          </Link>
          <Link href="/shop" className="btn-ghost">
            Continue browsing
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[760px] py-16">
      <p className="kicker mb-3">Card</p>
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {failed ? "Card payment did not finish" : "Confirming card payment"}
      </h1>
      <p className="mb-6 text-sm leading-7 text-[#8f8c84]">
        {failed
          ? "That includes a declined card and a 3D Secure or bank step that was cancelled. Nothing else was charged. You can try the card again below."
          : "If you completed a bank or 3D Secure step, wait for the confirmation email before treating this order as paid."}
      </p>
      {error && (
        <p className="mb-4 text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      {loading && (
        <p className="text-sm leading-6 text-[#8f8c84]" role="status">
          Opening secure card checkout.
        </p>
      )}
      {embed && <WhopCheckoutElement session={embed} />}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link href={`/order/${reference}`} className="btn-ghost">
          View order {reference}
        </Link>
        <Link href="/checkout?pay=whop" className="btn-ghost">
          Back to checkout
        </Link>
      </div>
    </div>
  );
}
