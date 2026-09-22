import type { Metadata } from "next";
import { PolicyLayout } from "@/components/PolicyLayout";
import {
  BRAND_NAME,
  COMPANY_NUMBER,
  INCORPORATION_DATE_LABEL,
  JURISDICTION,
  LEGAL_NAME,
} from "@/lib/company";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "Terms for using the Redline Labs storefront, operated by RedlineLabs Limited, a verified registered private corporation in Hong Kong. All listings are for laboratory research use only.",
};

export default function TermsPage() {
  return (
    <PolicyLayout kicker="Legal agreement" title="Terms of Service" updated="September 2026">
      <h2>The Company</h2>
      <p>
        This website is operated by {LEGAL_NAME} (Hong Kong company number{" "}
        {COMPANY_NUMBER}), a verified registered private corporation
        incorporated in {JURISDICTION} on {INCORPORATION_DATE_LABEL}. In these
        terms, “{BRAND_NAME}”, “we”, and “us” mean that company.
      </p>
      <h2>Acceptance of Terms</h2>
      <p>
        By accessing or using the Redline Labs website, you agree to be bound
        by these Terms of Service. If you do not agree with any part of these
        terms, you should discontinue use of the website and services.
      </p>
      <h2>Website Use</h2>
      <p>
        Users agree to use this website lawfully and responsibly. Any activity
        that disrupts website functionality, security, or the experience of
        other users is strictly prohibited.
      </p>
      <h2>Research Use Only</h2>
      <p>
        All products are supplied strictly for laboratory research. They are
        not medicines, food, or cosmetics, and are not intended for human or
        veterinary use, diagnosis, or treatment.
      </p>
      <h2>Accounts</h2>
      <p>
        Access to full order history, certificates of analysis requests,
        tracking numbers, store credit, saved addresses, and stock alerts
        requires an account. You are responsible for keeping your sign-in
        details confidential. Redline Labs may suspend accounts used in
        breach of these terms.
      </p>
      <h2>Orders & Payments</h2>
      <p>
        All orders are subject to acceptance and availability. Redline Labs
        reserves the right to refuse, cancel, or limit orders at its sole
        discretion. Payment must be successfully completed before order
        processing begins.
      </p>
      <h2>Intellectual Property</h2>
      <p>
        All content on this website, including logos, graphics, text, images,
        layouts, and branding elements, remains the property of Redline Labs
        and may not be copied, reproduced, or distributed without prior written
        permission.
      </p>
      <h2>Limitation of Liability</h2>
      <p>
        To the fullest extent permitted by law, Redline Labs shall not be
        liable for indirect, incidental, consequential, or special damages
        arising from the use of this website, products, or related services.
      </p>
      <h2>Changes to Terms</h2>
      <p>
        Redline Labs may update these Terms of Service periodically. Continued
        use of the website after changes have been published constitutes
        acceptance of the revised terms.
      </p>
    </PolicyLayout>
  );
}
