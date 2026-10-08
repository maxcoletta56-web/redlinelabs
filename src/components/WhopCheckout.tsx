"use client";

import { useEffect, useState } from "react";
import { Checkout, CheckoutElement, loadWhop, useWhop, WhopElements } from "@/vendor/whop";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import type { CartLineInput } from "@/lib/order";
import { formatPrice } from "@/lib/products";
import { withTimeout } from "@/lib/with-timeout";

export type WhopEnvironment = "sandbox" | "production";

const TERMINAL_STATUS = new Set(["succeeded", "failed", "canceled", "cancelled"]);

/**
 * Embedded Whop Checkout Element. The session id is a checkout configuration
 * created on the server. Card data stays in Whop's frame.
 *
 * 3D Secure and other off-site steps return to `returnUrl` with `payment` and
 * `status`. A still-pending step also includes `client_secret`; that secret is
 * handed to `handleNextAction`, which runs the issuer dialog or redirect.
 */
export function WhopCheckoutElement({
  sessionId,
  environment,
  returnUrl,
  email,
}: {
  sessionId: string;
  environment: WhopEnvironment;
  returnUrl: string;
  email?: string;
}) {
  const [elements, setElements] = useState<ReturnType<typeof loadWhop> | null>(null);

  useEffect(() => {
    setElements(loadWhop());
  }, []);

  if (!elements) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Loading card checkout.
      </p>
    );
  }

  return (
    <WhopElements elements={elements} environment={environment}>
      <Checkout
        checkoutConfiguration={sessionId}
        returnUrl={returnUrl}
        buyerEmail={email || undefined}
        lockBuyerEmail={Boolean(email)}
      >
        <CheckoutElement />
      </Checkout>
    </WhopElements>
  );
}

type NextActionResult = {
  status?: string;
  redirected?: boolean;
  lastPaymentError?: { message?: string | null } | null;
};

/**
 * Completes a 3DS or other next action when the buyer lands back with a
 * client secret and a non-terminal status. A full-page step navigates away
 * (`redirected: true`). An inline step resolves here.
 */
export function WhopNextAction({
  clientSecret,
  environment,
  returnUrl,
  onResult,
}: {
  clientSecret: string;
  environment: WhopEnvironment;
  returnUrl: string;
  onResult: (result: { status: string; message: string | null }) => void;
}) {
  const [elements, setElements] = useState<ReturnType<typeof loadWhop> | null>(null);

  useEffect(() => {
    setElements(loadWhop());
  }, []);

  if (!elements) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Continuing card authentication.
      </p>
    );
  }

  return (
    <WhopElements elements={elements} environment={environment}>
      <NextActionRunner clientSecret={clientSecret} returnUrl={returnUrl} onResult={onResult} />
    </WhopElements>
  );
}

function NextActionRunner({
  clientSecret,
  returnUrl,
  onResult,
}: {
  clientSecret: string;
  returnUrl: string;
  onResult: (result: { status: string; message: string | null }) => void;
}) {
  const whop = useWhop();

  useEffect(() => {
    if (!whop) return;
    let cancelled = false;
    const payments = whop.payments as {
      handleNextAction?: (input: { clientSecret: string; returnUrl: string }) => Promise<NextActionResult>;
    };
    const checkout = whop.checkout as {
      handleNextAction?: (input: { clientSecret: string; returnUrl: string }) => Promise<NextActionResult>;
    };
    const run = payments.handleNextAction ?? checkout.handleNextAction;
    if (!run) {
      onResult({
        status: "failed",
        message: "Card authentication could not be continued. You can try the payment again.",
      });
      return;
    }

    run({ clientSecret, returnUrl })
      .then((result) => {
        if (cancelled || result.redirected) return;
        onResult({
          status: result.status ?? "failed",
          message: result.lastPaymentError?.message ?? null,
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error("whop next action failed", error);
        onResult({
          status: "failed",
          message: "Card authentication could not be completed. Nothing else has been charged from this page.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [whop, clientSecret, returnUrl, onResult]);

  return (
    <p className="text-sm leading-6 text-[#8f8c84]" role="status">
      Your bank needs an extra confirmation. Complete it in the prompt, then this page updates.
    </p>
  );
}

export function whopReturnNeedsNextAction(status: string | null, clientSecret: string | null) {
  if (!clientSecret) return false;
  if (!status) return true;
  return !TERMINAL_STATUS.has(status);
}

const SUBMIT_TIMEOUT_MS = 25_000;

/** Creates the pending order, then mounts the embedded element. No redirect. */
export function WhopCardCheckout({
  items,
  email,
  firstName,
  lastName,
  shipping,
  promoCode,
  ageConfirmed,
  researchUse,
}: {
  items: CartLineInput[];
  email: string;
  firstName: string;
  lastName: string;
  shipping?: ShippingAddressInput | null;
  promoCode?: string | null;
  ageConfirmed: boolean;
  researchUse: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [session, setSession] = useState<{
    sessionId: string;
    environment: WhopEnvironment;
    returnUrl: string;
    reference: string;
    amountCents: number;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    withTimeout(
      startCartCheckoutSession({
        items,
        email,
        firstName,
        lastName,
        shipping,
        promoCode,
        club: null,
        ageConfirmed,
        researchUse,
        method: "whop",
      }),
      SUBMIT_TIMEOUT_MS,
      "Checkout",
    )
      .then((result) => {
        if (cancelled) return;
        if (result.ok && result.method === "whop") {
          setSession({
            sessionId: result.sessionId,
            environment: result.environment,
            returnUrl: result.returnUrl,
            reference: result.reference,
            amountCents: result.amountCents,
          });
          return;
        }
        setError(result.ok ? "Card checkout could not be started." : result.error);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        console.error("card checkout failed", reason);
        setError(
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Checkout is taking longer than expected. Nothing has been charged."
            : "Card checkout could not be started. Nothing has been charged.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, items, email, firstName, lastName, shipping, promoCode, ageConfirmed, researchUse]);

  if (error) {
    return (
      <div className="space-y-3" role="alert">
        <p className="text-sm leading-6 text-[#d4af37]">{error}</p>
        <button
          type="button"
          className="btn"
          onClick={() => {
            setError(null);
            setSession(null);
            setAttempt((count) => count + 1);
          }}
        >
          Try again
        </button>
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

  if (!session) {
    return (
      <p className="text-sm leading-6 text-[#8f8c84]" role="status">
        Preparing card checkout. The amount is calculated on the server.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-[#8f8c84]">
        Charging <span className="text-[#d4af37]">{formatPrice(session.amountCents / 100)} AUD</span>{" "}
        for order {session.reference}. Card details are entered in the Whop frame below and never
        reach this site.
      </p>
      {session.environment === "sandbox" ? <SandboxTestCards /> : null}
      <WhopCheckoutElement
        sessionId={session.sessionId}
        environment={session.environment}
        returnUrl={session.returnUrl}
        email={email}
      />
    </div>
  );
}

export function SandboxTestCards() {
  return (
    <div className="surface mb-4 p-4 text-sm leading-6 text-[#8f8c84]">
      <p className="text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
        Whop sandbox
      </p>
      <p className="mt-2">
        No real charge is made. Use a future expiry and any CVC.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>
          <span className="text-[#cfc8b8]">4242 4242 4242 4242</span> succeeds
        </li>
        <li>
          <span className="text-[#cfc8b8]">4000 0000 0000 0002</span> declines
        </li>
        <li>
          <span className="text-[#cfc8b8]">5385 3083 6013 5181</span> asks for 3D Secure. The test
          password is Checkout1!
        </li>
      </ul>
    </div>
  );
}
