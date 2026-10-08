import type { Metadata } from "next";
import Link from "next/link";
import { ClubBalanceLookup } from "@/components/ClubBalanceLookup";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Club balance",
  description:
    "Check your Redline Club points balance, tier and recent points activity with your email and member code.",
  path: "/club/balance",
  index: false,
});

export default function ClubBalancePage() {
  return (
    <div className="wrap max-w-[620px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Club" title="Your points balance" crumb="Club balance">
        Enter the email you joined with and the member code shown when you joined.
      </PageIntro>
      <ClubBalanceLookup />
      <p className="mt-8 text-sm leading-7 text-[#8f8c84]">
        Not a member yet?{" "}
        <Link href="/club" className="text-[#d4af37]">
          Join the Redline Club
        </Link>
        .
      </p>
    </div>
  );
}
