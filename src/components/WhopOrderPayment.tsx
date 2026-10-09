"use client";

import { useState } from "react";
import { resumeWhopOrder } from "@/app/actions/checkout";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";

type Embed = {
  sessionId: string;
  planId: string | null;
  returnUrl: string;
  environment: "sandbox" | "production";
};

/** Remounts the embedded element after a failed or abandoned card attempt, including 3D Secure. */
export function WhopOrderPayment({ reference, email }: { reference: string; email: string }) {
  const [embed, setEmbed] = useState<Embed | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function open() {
    setPending(true);
    setError(null);
    const result = await resumeWhopOrder(reference);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEmbed(result.whop);
  }

  if (embed) {
    return (
      <WhopCheckoutElement
        sessionId={embed.sessionId}
        planId={embed.planId}
        returnUrl={embed.returnUrl}
        environment={embed.environment}
        email={email}
      />
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <button type="button" className="btn" onClick={() => void open()} disabled={pending}>
        {pending ? "Opening card checkout" : "Try card again"}
      </button>
    </div>
  );
}
