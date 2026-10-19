import type { Metadata } from "next";
import Link from "next/link";
import { ClubBalanceLookup } from "@/components/ClubBalanceLookup";
import { PageIntro } from "@/components/PageIntro";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Your membership",
  description:
    "Check whether your Redline membership is active, and cancel renewal, with your email and member code.",
  path: "/club/balance",
  index: false,
});

export default function ClubBalancePage() {
  return (
    <div className="wrap max-w-[620px] py-16">
      <PageIntro kicker="Redline Membership" title="Your membership" crumb="Membership">
        Enter the email you subscribed with and the member code from your welcome message.
      </PageIntro>
      <ClubBalanceLookup />
      <p className="mt-8 text-sm leading-7 text-[#8f8c84]">
        Not a member yet?{" "}
        <Link href="/club" className="text-[#d4af37]">
          See membership
        </Link>
        .
      </p>
    </div>
  );
}
