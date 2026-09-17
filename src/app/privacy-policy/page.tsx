import type { Metadata } from "next";
import Link from "next/link";
import { PolicyLayout } from "@/components/PolicyLayout";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPolicyPage() {
  return (
    <PolicyLayout kicker="Legal information" title="Privacy Policy" updated="June 2026">
      <h2>Introduction</h2>
      <p>
        Redline Labs respects your privacy and is committed to protecting your
        personal information. This Privacy Policy explains how information is
        collected, used, and safeguarded when you visit our website or interact
        with our services.
      </p>
      <h2>Information We Collect</h2>
      <p>
        We may collect information provided directly by you, including your
        name, email address, billing information, shipping details, account
        profile data (order history, saved addresses, store credit movements,
        and stock alerts), and communications submitted through our website.
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
