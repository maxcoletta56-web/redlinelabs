import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout } from "@/components/PolicyLayout";
import { COMPANY_NUMBER, LEGAL_NAME } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Refund Policy",
  description:
    "When Redline Labs may review refunds for damaged, incorrect, or unverified fulfilment issues, and how approved returns are processed.",
  path: "/refund-policy",
});

export default function RefundPolicyPage() {
  return (
    <PolicyLayout kicker="Returns & refunds" title="Refund Policy" updated="September 2026">
      <h2>Overview</h2>
      <p>
        Customer satisfaction is important to {LEGAL_NAME} (Hong Kong company
        number {COMPANY_NUMBER}), a verified registered private corporation
        trading as Redline Labs. This Refund Policy outlines the conditions
        under which refund requests may be reviewed and processed.
      </p>
      <h2>Eligibility For Refunds</h2>
      <p>
        Refund requests may be considered for orders that arrive damaged,
        contain incorrect items, or experience verified fulfillment issues.
        Requests must be submitted within a reasonable timeframe after delivery.
      </p>
      <h2>Non-Refundable Items</h2>
      <p>
        Due to the nature of our products, opened, used, altered, or improperly
        stored items are generally not eligible for refunds or exchanges unless
        required by applicable law.
      </p>
      <h2>Damaged Orders</h2>
      <p>
        If your order arrives damaged, please contact us promptly through the{" "}
        <Link href="/contact" className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3">
          Contact
        </Link>{" "}
        page and provide relevant information, including photographs of the
        package and contents where applicable.
      </p>
      <h2>Incorrect Orders</h2>
      <p>
        If you receive an incorrect item, notify us as soon as possible so we
        can review the situation and determine an appropriate resolution.
      </p>
      <h2>Approved Refunds</h2>
      <p>
        If a refund is approved, funds will generally be returned through the
        original payment method used during checkout. Processing times may vary
        depending on the payment provider.
      </p>
      <h2>Shipping Charges</h2>
      <p>
        Shipping fees, duties, taxes, and carrier-related costs may not be
        refundable unless otherwise required by applicable law.
      </p>
    </PolicyLayout>
  );
}
