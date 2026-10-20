import type { Metadata } from "next";
import Link from "next/link";
import { ClubJoinForm } from "@/components/ClubJoinForm";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { CLUB_PROGRAM, formatCents } from "@/lib/club";
import { MEMBERSHIP_PRICE_CENTS } from "@/lib/membership";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Redline Club",
  description:
    "Join Redline Club for a one-time $15 sign-up fee. Earn 1 point per $1 spent. Bronze, Silver, Gold and Platinum follow lifetime spend.",
  path: "/club",
});

const benefits = [
  "One-time sign-up fee",
  "1 point for every $1 you spend after you join",
  "Bronze, Silver, Gold and Platinum from lifetime spend",
  "Points stay on your membership and are not taken off checkout",
];

export default function ClubPage() {
  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Club" title="Join the club" crumb="Club">
        A {price} sign-up, once. After that, spend earns points and a tier.
      </PageIntro>

      <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="surface p-6" aria-labelledby="membership-price">
          <p id="membership-price" className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
            Sign-up fee
          </p>
          <p className="mt-3 text-[2.4rem] leading-none font-semibold tracking-[-0.03em] text-white">
            {price}
            <span className="ml-2 text-base font-medium text-[#8f8c84]">one-time</span>
          </p>
          <ul className="mt-6 space-y-3 text-sm leading-6 text-[#cfc8b8]">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex gap-3">
                <span className="text-[#d4af37]" aria-hidden>
                  ✓
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CLUB_PROGRAM.tiers.map((tier) => (
              <li key={tier.name} className="border border-[rgba(212,175,55,0.2)] px-4 py-3">
                <p className="text-sm font-semibold text-white">{tier.name}</p>
                <p className="text-sm text-[#8f8c84]">From {formatCents(tier.fromCents ?? 0)} spent</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm leading-7 text-[#8f8c84]">
            Spend under {formatCents(CLUB_PROGRAM.tiers[0]?.fromCents ?? 0)} stays at Member, and still earns 1 point
            per $1. The full ladder is on the{" "}
            <Link href="/club/specials" className="text-[#d4af37]">
              spend tiers
            </Link>{" "}
            page.
          </p>
        </section>

        <aside>
          <h2 className="mb-5 text-[13px] font-semibold tracking-[0.12em] uppercase">
            Get started
          </h2>
          <ClubJoinForm />
          <p className="mt-4 text-sm leading-7 text-[#8f8c84]">
            Already in the club?{" "}
            <Link href="/club/balance" className="text-[#d4af37]">
              Check your points
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
