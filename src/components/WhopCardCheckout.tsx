"use client";

import { useEffect, useRef, useState } from "react";
import type { WhopEmbedSession } from "@/lib/whop-session";

const SDK_URL = "https://cdn.whop.com/elements/amber/elements.js";

type WhopElementsFactory = (config: { environment: WhopEmbedSession["environment"] }) => {
  checkout: {
    create: (options: {
      plan: string;
      returnUrl: string;
      metadata: { orderId: string };
      onComplete?: (result: { result?: string; paymentId?: string; sessionId?: string }) => void;
    }) => {
      create: (
        element: "checkout",
        options: { buyerEmail: string; lockBuyerEmail: boolean },
      ) => { container: HTMLElement; destroy?: () => void };
      destroy?: () => void;
      teardown?: () => void;
    };
  };
};

type WhopWindow = Window & { WhopElements?: WhopElementsFactory };

let loading: Promise<WhopElementsFactory> | null = null;

function loadWhopElements() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Card checkout needs a browser"));
  }
  const existing = (window as WhopWindow).WhopElements;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<WhopElementsFactory>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.async = true;
    script.dataset.whopElements = "";
    script.onload = () => {
      const factory = (window as WhopWindow).WhopElements;
      if (factory) resolve(factory);
      else reject(new Error("Card checkout did not load"));
    };
    script.onerror = () => reject(new Error("Card checkout did not load"));
    document.head.appendChild(script);
  });
  return loading;
}

/**
 * Whop Checkout Element. 3D Secure and other bank steps stay inside the
 * element: a challenge that leaves the page returns to `returnUrl`, and a
 * dismissed challenge stays on "Finish your payment" in the element.
 * The webhook, not this callback, marks the order paid.
 */
export function WhopCardCheckout({ session }: { session: WhopEmbedSession }) {
  const slot = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const slotNode = slot.current;
    if (!slotNode) return;
    let cancelled = false;
    let element: { destroy?: () => void } | null = null;
    let handle: { destroy?: () => void; teardown?: () => void } | null = null;

    loadWhopElements()
      .then((factory) => {
        if (cancelled) return;
        const root = factory({ environment: session.environment });
        handle = root.checkout.create({
          plan: session.planId,
          returnUrl: session.returnUrl,
          metadata: { orderId: session.reference },
          onComplete: () => {
            window.location.assign(session.returnUrl);
          },
        });
        element = handle.create("checkout", {
          buyerEmail: session.email,
          lockBuyerEmail: true,
        });
        slotNode.replaceChildren(element.container);
      })
      .catch(() => {
        if (!cancelled) setError("Card checkout did not load. Nothing has been charged.");
      });

    return () => {
      cancelled = true;
      element?.destroy?.();
      if (handle?.destroy) handle.destroy();
      else handle?.teardown?.();
      slotNode.replaceChildren();
    };
  }, [attempt, session]);

  return (
    <div className="space-y-3">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Pay by card below. If your bank asks you to verify the payment, finish that step in
        this checkout. The order is marked paid only after Whop confirms it.
      </p>
      {session.environment === "sandbox" && (
        <p className="text-xs leading-5 text-[#8f8c84]">
          Sandbox mode. Use a Whop test card. No live charge is made.
        </p>
      )}
      <div ref={slot} className="min-h-[420px]" />
      {error && (
        <div className="space-y-3" role="alert">
          <p className="text-sm leading-6 text-[#d4af37]">{error}</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setError(null);
              loading = null;
              setAttempt((count) => count + 1);
            }}
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
