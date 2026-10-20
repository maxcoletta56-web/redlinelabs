import type { Metadata } from "next";
import Link from "next/link";
import { ClubBalanceLookup } from "@/components/ClubBalanceLookup";
import { PageIntro } from "@/components/PageIntro";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Your club",
  description: "See your Redline Club tier and points with your email and member code.",
  path: "/club/balance",
  index: false,
});

export default function ClubBalancePage() {
  return (
    <div className="wrap max-w-[620px] py-16">
      <PageIntro kicker="Redline Club" title="Your points" crumb="Club">
        Enter the email you joined with and the member code from your payment email.
      </PageIntro>
      <ClubBalanceLookup />
      <p className="mt-8 text-sm leading-7 text-[#8f8c84]">
        Not in the club yet?{" "}
        <Link href="/club" className="text-[#d4af37]">
          Join for $15
        </Link>
        .
      </p>
    </div>
  );
}
