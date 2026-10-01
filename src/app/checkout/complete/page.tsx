import type { Metadata } from "next";
import Link from "next/link";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { normalizeOrderReference } from "@/lib/order-reference";
import { absoluteRequestUrl } from "@/lib/request-origin";
import { pageMetadata } from "@/lib/seo";
import { whopEmbedEnvironment } from "@/lib/whop";

export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMetadata({
  title: "Payment",
  description: "Card payment result for a Redline Labs order. This page is not indexed.",
  path: "/checkout/complete",
  index: false,
});

type Search = {
  status?: string;
  order?: string;
  session?: string;
  plan?: string;
};

function whopId(value: string | undefined, prefix: "ch" | "plan") {
  if (!value) return null;
  return new RegExp(`^${prefix}_[A-Za-z0-9]+$`).test(value) ? value : null;
}

/**
 * Landing page for 3D Secure and other redirect-based next actions.
 * `status=success` only confirms the browser returned. The webhook marks the
 * order paid. `status=error` remounts the same embedded checkout.
 */
export default async function CheckoutCompletePage({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  const params = await searchParams;
  const status = params.status === "success" || params.status === "error" ? params.status : null;
  const reference = normalizeOrderReference(params.order ?? "");
  const sessionId = whopId(params.session, "ch");
  const planId = whopId(params.plan, "plan");
  const environment = whopEmbedEnvironment();
  const remount = status === "error" && sessionId !== null && planId !== null;
  const returnUrl =
    remount && sessionId && planId
      ? await absoluteRequestUrl(
          `/checkout/complete?order=${encodeURIComponent(reference ?? "")}&session=${encodeURIComponent(sessionId)}&plan=${encodeURIComponent(planId)}`,
        )
      : "";

  return (
    <div className="wrap max-w-[760px] py-16">
      {status === "success" && <ClearCartOnSuccess />}
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/checkout", label: "Checkout" },
          { label: "Payment" },
        ]}
      />
      <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">
        {status === "success" ? "Payment submitted" : status === "error" ? "Payment not completed" : "Payment"}
      </h1>
      {status === "success" && (
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The card form reported a successful payment
          {reference ? ` for order ${reference}` : ""}. The order is marked paid when Whop confirms
          it, and the confirmation email goes out then.
        </p>
      )}
      {status === "error" && (
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          The bank check was not completed, or the payment was canceled. The same card form is below
          so you can try again. Nothing is marked paid until Whop confirms the payment.
        </p>
      )}
      {status === null && (
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          This page opens after a card payment leaves this site for a bank check and comes back.
        </p>
      )}
      {remount && (
        <div className="surface mb-8 overflow-hidden p-3">
          <WhopCheckoutElement
            planId={planId}
            sessionId={sessionId}
            environment={environment}
            returnUrl={returnUrl}
          />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {reference && (
          <Link href={`/order/${reference}`} className="btn">
            View order {reference}
          </Link>
        )}
        <Link href="/checkout" className="btn-ghost">
          Return to checkout
        </Link>
      </div>
    </div>
  );
}
