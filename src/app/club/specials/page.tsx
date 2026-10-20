import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { CLUB_PROGRAM, PRE_TIER_NAME, formatCents } from "@/lib/club";
import { MEMBERSHIP_PRICE_CENTS } from "@/lib/membership";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Spend tiers",
  description:
    "Redline Club tiers from lifetime spend: Bronze $500, Silver $1,000, Gold $1,500, Platinum $2,000. One point per dollar. Join for $15.",
  path: "/club/specials",
});

export default function MemberSpecialsPage() {
  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);
  const bronze = CLUB_PROGRAM.tiers[0];

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Club" title="Spend tiers" crumb="Spend tiers">
        Points follow what you pay. The tier follows lifetime spend. Neither one changes the checkout total.
      </PageIntro>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-[36rem] text-sm leading-7 text-[#8f8c84]">
          1 point per $1 spent. Spend under {formatCents(bronze?.fromCents ?? 0)} is {PRE_TIER_NAME}.
        </p>
        <Link href="/club" className="btn">
          Join for {price}
        </Link>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {CLUB_PROGRAM.tiers.map((tier) => (
          <li key={tier.name} className="surface p-5">
            <p className="text-[11px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
              {tier.name}
            </p>
            <h2 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.03em] text-white">
              {formatCents(tier.fromCents ?? 0)}
            </h2>
            <p className="mt-3 text-sm leading-6 text-[#cfc8b8]">
              Lifetime spend from {formatCents(tier.fromCents ?? 0)}. 1 point per $1 paid.
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
