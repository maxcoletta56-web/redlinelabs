import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout } from "@/components/PolicyLayout";
import {
  BRAND_NAME,
  COMPANY_NUMBER,
  JURISDICTION,
  LEGAL_NAME,
} from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How RedlineLabs Limited, trading as Redline Labs, collects and stores order, account, and checkout information, including data kept in your browser.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout kicker="Legal information" title="Privacy Policy" updated="September 2026">
      <h2>Introduction</h2>
      <p>
        This Privacy Policy is issued by {LEGAL_NAME} (Hong Kong company number{" "}
        {COMPANY_NUMBER}), a verified registered private corporation
        incorporated in {JURISDICTION}. {BRAND_NAME} is the trading name used
        on this storefront. We respect your privacy and are committed to
        protecting your personal information. This Privacy Policy explains how
        information is collected, used, and safeguarded when you visit our
        website or interact with our services.
      </p>
      <h2>Information We Collect</h2>
      <p>
        We may collect information provided directly by you, including your
        name, email address, billing information, shipping details, account
        profile data (order history, saved addresses, store credit movements,
        and stock alerts), and communications submitted through our website.
        Account sign-in, saved addresses, stock alerts, and order history for
        this storefront are stored in your browser (local storage) on this
        device, in addition to any data Whop collects to process a card payment.
      </p>
      <h2>How Information Is Used</h2>
      <p>
        Information may be used to process orders, improve website
        functionality, provide customer support, communicate updates, and
        maintain security and operational efficiency.
      </p>
      <h2>Data Security</h2>
      <p>
        We implement reasonable security measures designed to protect personal
        information from unauthorized access, disclosure, or misuse.
      </p>
      <h2>Cookies & Analytics</h2>
      <p>
        Our website may utilize cookies and similar technologies to enhance
        user experience, monitor website performance, and analyze visitor
        interactions.
      </p>
      <h2>Your Rights</h2>
      <p>
        Depending on your location, you may have rights regarding access,
        correction, or deletion of personal information in accordance with
        applicable privacy laws.
      </p>
      <h2>Contact Information</h2>
      <p>
        For privacy-related inquiries, please contact us through the{" "}
        <Link href="/contact" className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3">
          Contact
        </Link>{" "}
        page.
      </p>
    </PolicyLayout>
  );
}
