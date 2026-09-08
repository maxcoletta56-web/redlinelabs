import type { Metadata } from "next";
import { PolicyLayout } from "@/components/PolicyLayout";

export const metadata: Metadata = { title: "Refund Policy" };

export default function RefundPolicyPage() {
  return (
    <PolicyLayout kicker="Returns & refunds" title="Refund Policy" updated="June 2026">
      <h2>Overview</h2>
      <p>
        Customer satisfaction is important to Redline Labs. This Refund Policy
        outlines the conditions under which refund requests may be reviewed and
        processed.
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
        If your order arrives damaged, please contact us promptly and provide
        relevant information, including photographs of the package and contents
        where applicable.
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
