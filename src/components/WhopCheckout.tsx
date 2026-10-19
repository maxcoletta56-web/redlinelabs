"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { resumeWhopCheckout } from "@/app/actions/checkout";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import type { WhopEmbedSession } from "@/lib/whop-embed";
import { formatPrice } from "@/lib/products";

const SDK_URL = "https://cdn.whop.com/elements/amber/elements.js";

const TERMINAL_STATUS = new Set(["succeeded", "failed", "canceled", "cancelled"]);
const TERMINAL_RESULT = new Set(["payment", "setup", "waitlist_entry"]);

type NextActionResult = {
  status?: string;
  redirected?: boolean;
  lastPaymentError?: { message?: string | null } | null;
};

type MountedCheckout = { container: HTMLElement; destroy?: () => void };

type CheckoutHandle = {
  createElement?: (
    name: "checkout",
    options?: { buyerEmail?: string; lockBuyerEmail?: boolean },
  ) => MountedCheckout;
  create?: (
    name: "checkout",
    options?: { buyerEmail?: string; lockBuyerEmail?: boolean },
  ) => MountedCheckout;
  destroy?: () => void;
};

type WhopClient = {
  checkout: {
    create: (options: {
      checkoutConfiguration: string;
      returnUrl?: string;
      buyerEmail?: string;
      lockBuyerEmail?: boolean;
      onComplete?: (payload: {
        result?: string;
        clientSecret?: string;
        client_secret?: string;
      }) => void;
    }) => CheckoutHandle;
    handleNextAction?: (input: { clientSecret: string; returnUrl: string }) => Promise<NextActionResult>;
  };
  payments: {
    handleNextAction?: (input: { clientSecret: string; returnUrl: string }) => Promise<NextActionResult>;
  };
};

type WhopConstructor = (options: { environment: "sandbox" | "production" }) => WhopClient;

declare global {
  interface Window {
    WhopElements?: WhopConstructor;
  }
}

let sdkPromise: Promise<void> | null = null;

function loadWhopElements() {
  if (typeof window === "undefined") return Promise.reject(new Error("Whop loads in the browser"));
  if (window.WhopElements) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_URL}"]`);
      const script = existing ?? document.createElement("script");
      const finish = () => {
        if (window.WhopElements) resolve();
        else reject(new Error("Whop checkout could not be loaded"));
      };
      script.addEventListener("load", finish, { once: true });
      script.addEventListener(
        "error",
        () => {
          sdkPromise = null;
          reject(new Error("Whop checkout could not be loaded"));
        },
        { once: true },
      );
      if (!existing) {
        script.src = SDK_URL;
        script.async = true;
        document.head.appendChild(script);
      } else if (window.WhopElements) {
        resolve();
      }
    });
  }
  return sdkPromise;
}

async function whopClient(environment: "sandbox" | "production") {
  await loadWhopElements();
  const ctor = window.WhopElements;
  if (!ctor) throw new Error("Whop checkout could not be loaded");
  return ctor({ environment });
}

function clientSecretOf(payload: { clientSecret?: string; client_secret?: string }) {
  return payload.clientSecret ?? payload.client_secret ?? "";
}

/**
 * Embedded Checkout Element. `checkoutConfiguration` is the server session
 * (`ch_…`) whose price and `metadata.orderId` were set on the server.
 * Card data stays in Whop's frame. A completed purchase may navigate to
 * `returnUrl`; fulfillment waits for the webhook.
 */
export function WhopCheckoutElement({ session }: { session: WhopEmbedSession }) {
  const host = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    let handle: CheckoutHandle | null = null;

    loadWhopElements()
      .then(() => {
        if (cancelled) return null;
        return whopClient(session.environment);
      })
      .then((whop) => {
        if (cancelled || !whop || !node) return;
        handle = whop.checkout.create({
          checkoutConfiguration: session.sessionId,
          returnUrl: session.returnUrl,
          buyerEmail: session.email,
          lockBuyerEmail: Boolean(session.email),
          onComplete: (payload) => {
            const secret = clientSecretOf(payload);
            const result = payload.result ?? "";
            if (!secret || TERMINAL_RESULT.has(result)) return;
            const run = whop.payments.handleNextAction ?? whop.checkout.handleNextAction;
            if (!run) return;
            void run({ clientSecret: secret, returnUrl: session.returnUrl }).catch(() => {
              if (!cancelled) {
                setError(
                  "Your bank needs another step to finish this payment. Use the button in the card form, or return to this page.",
                );
              }
            });
          },
        });
        const element = handle.createElement
          ? handle.createElement("checkout", {
              buyerEmail: session.email,
              lockBuyerEmail: Boolean(session.email),
            })
          : handle.create?.("checkout", {
              buyerEmail: session.email,
              lockBuyerEmail: Boolean(session.email),
            });
        if (!element) throw new Error("Whop checkout could not be loaded");
        node.replaceChildren(element.container);
      })
      .catch(() => {
        if (!cancelled) setError("Card checkout could not be loaded. Nothing has been charged.");
      });

    return () => {
      cancelled = true;
      handle?.destroy?.();
      node.replaceChildren();
    };
  }, [session]);

  return (
    <div>
      {session.environment === "sandbox" ? <SandboxTestCards /> : null}
      <div ref={host} className="min-h-[420px]" />
      {error ? (
        <p className="mt-3 text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SandboxTestCards() {
  return (
    <div className="mb-4 text-sm leading-6 text-[#8f8c84]">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
        Whop sandbox
      </p>
      <p className="mt-2">
        No real charge is made. Use test card <span className="text-[#cfc8b8]">4242 4242 4242 4242</span>
        , any future expiry, and any CVC. If your bank asks for 3D Secure, finish it in the prompt.
        A dismissed challenge leaves a Finish your payment button in the form.
      </p>
    </div>
  );
}

export function whopReturnNeedsNextAction(status: string | null, clientSecret: string | null) {
  if (!clientSecret) return false;
  if (!status) return true;
  return !TERMINAL_STATUS.has(status);
}

function WhopNextAction({
  clientSecret,
  environment,
  returnUrl,
  onResult,
}: {
  clientSecret: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  onResult: (result: { status: string; message: string | null }) => void;
}) {
  useEffect(() => {
    let cancelled = false;
    whopClient(environment)
      .then((whop) => {
        const run = whop.payments.handleNextAction ?? whop.checkout.handleNextAction;
        if (!run) {
          onResult({
            status: "failed",
            message: "Card authentication could not be continued. You can try the payment again.",
          });
          return null;
        }
        return run({ clientSecret, returnUrl });
      })
      .then((result) => {
        if (cancelled || !result || result.redirected) return;
        onResult({
          status: result.status ?? "failed",
          message: result.lastPaymentError?.message ?? null,
        });
      })
      .catch(() => {
        if (cancelled) return;
        onResult({
          status: "failed",
          message: "Card authentication could not be completed. Nothing else has been charged from this page.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [clientSecret, environment, returnUrl, onResult]);

  return (
    <p className="text-sm leading-6 text-[#8f8c84]" role="status">
      Your bank needs an extra confirmation. Complete it in the prompt. This page does not mark the
      order paid.
    </p>
  );
}

/**
 * Status Whop appends after 3D Secure or another off-site step. A succeeded
 * visit is not a sale. A non-terminal `client_secret` is handed to
 * `payments.handleNextAction`.
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
  const [session, setSession] = useState<WhopEmbedSession | null>(null);
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
    const result = await resumeWhopCheckout(reference);
    setPending(false);
    if (!result.ok || !("whop" in result)) {
      setError(result.ok ? "Card checkout could not be restarted." : result.error);
      return;
    }
    setSession(result.whop);
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
          Charging{" "}
          <span className="text-[#d4af37]">{formatPrice(session.amountCents / 100)} AUD</span> again
          for the same order. The price is the amount already saved on the order.
        </p>
        <WhopCheckoutElement session={session} />
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
      {reference ? (
        <p>
          <Link href={`/order/${reference}`} className="text-[#d4af37]">
            View order {reference}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

/** Continues a pending or failed card order without leaving the site. */
export function WhopOrderPayment({ reference }: { reference: string }) {
  const [session, setSession] = useState<WhopEmbedSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (session) return <WhopCheckoutElement session={session} />;

  return (
    <div className="space-y-3">
      {error ? (
        <p className="text-sm leading-6 text-[#d4af37]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        className="btn"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void resumeWhopCheckout(reference).then((result) => {
            setPending(false);
            if (result.ok && "whop" in result) {
              setSession(result.whop);
              return;
            }
            setError(result.ok ? "Card checkout could not be opened." : result.error);
          });
        }}
      >
        {pending ? "Opening card checkout" : "Continue card payment"}
      </button>
    </div>
  );
}
