"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { resumeCardCheckout } from "@/app/actions/checkout";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { SandboxTestCards, WhopCheckoutElement, WhopNextAction, whopReturnNeedsNextAction } from "@/components/WhopCheckout";
import { formatPrice } from "@/lib/products";

/**
 * Branches on the status Whop appends to the return URL. A succeeded visit is
 * not a sale: fulfillment waits for payment.succeeded. A client_secret with a
 * non-terminal status is a 3D Secure or other next action.
 */
export function WhopReturnStatus({
  reference,
  status,
  clientSecret,
  environment,
  returnUrl,
}: {
  reference: string | null;
  status: string | null;
  clientSecret: string | null;
  environment: "sandbox" | "production";
  returnUrl: string;
}) {
  const [action, setAction] = useState<{ status: string; message: string | null } | null>(null);
  const [session, setSession] = useState<{
    sessionId: string;
    environment: "sandbox" | "production";
    returnUrl: string;
    amountCents: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onResult = useCallback((result: { status: string; message: string | null }) => {
    setAction(result);
  }, []);

  const shown = action?.status ?? status;
  const needsAction = !action && whopReturnNeedsNextAction(status, clientSecret);

  async function retry() {
    if (!reference) return;
    setError(null);
    setPending(true);
    const result = await resumeCardCheckout(reference);
    setPending(false);
    if (!result.ok || result.method !== "whop") {
      setError(result.ok ? "Card checkout could not be restarted." : result.error);
      return;
    }
    setSession({
      sessionId: result.sessionId,
      environment: result.environment,
      returnUrl: result.returnUrl,
      amountCents: result.amountCents,
    });
  }

  if (needsAction && clientSecret) {
    return (
      <WhopNextAction
        clientSecret={clientSecret}
        environment={environment}
        returnUrl={returnUrl}
        onResult={onResult}
      />
    );
  }

  if (shown === "succeeded") {
    return (
      <div className="space-y-4">
        <ClearCartOnSuccess />
        <p className="text-sm leading-7 text-[#8f8c84]" role="status">
          The card step finished{reference ? ` for order ${reference}` : ""}. Confirmation is sent
          by email once the payment is verified. This page does not mark the order paid.
        </p>
        {reference ? (
          <Link href={`/order/${reference}`} className="btn">
            View order
          </Link>
        ) : null}
      </div>
    );
  }

  if (session) {
    return (
      <div className="space-y-4">
        <p className="text-sm leading-6 text-[#8f8c84]">
          Charging <span className="text-[#d4af37]">{formatPrice(session.amountCents / 100)} AUD</span>{" "}
          again for the same order. The price is the amount already saved on the order.
        </p>
        {session.environment === "sandbox" ? <SandboxTestCards /> : null}
        <WhopCheckoutElement
          sessionId={session.sessionId}
          environment={session.environment}
          returnUrl={session.returnUrl}
        />
      </div>
    );
  }

  const failed = shown === "failed" || shown === "canceled" || shown === "cancelled";
  return (
    <div className="space-y-4" role="status">
      <p className="text-sm leading-7 text-[#8f8c84]">
        {failed
          ? shown === "canceled" || shown === "cancelled"
            ? "The card step was canceled before payment. Nothing was marked paid."
            : "The card payment did not complete. You can try the same order again."
          : "The card payment is still processing. If your bank asked for an extra confirmation and you finished it, the confirmation email arrives when the payment is verified."}
        {action?.message ? ` ${action.message}` : ""}
      </p>
      {error ? <p className="text-sm leading-6 text-[#d4af37]">{error}</p> : null}
      {reference && failed ? (
        <button type="button" className="btn" disabled={pending} onClick={() => void retry()}>
          {pending ? "Restarting card checkout" : "Try card payment again"}
        </button>
      ) : null}
    </div>
  );
}
