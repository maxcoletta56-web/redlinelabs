import type { Metadata } from "next";
import Link from "next/link";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import {
  MEMBER_DISCOUNT_PERCENT,
  MEMBERSHIP_PRICE_CENTS,
  daysUntilNextOffers,
  memberUnitCents,
  monthSpecials,
  offerMonthLabel,
} from "@/lib/membership";
import { formatPrice, getProduct } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Member specials",
  description:
    "This month's Redline member prices. New specials go live on the 1st. Join from $50 a month.",
  path: "/club/specials",
});

export default function MemberSpecialsPage() {
  const now = new Date();
  const label = offerMonthLabel(now);
  const days = daysUntilNextOffers(now);
  const offers = monthSpecials(now)
    .map((slug) => getProduct(slug))
    .filter((product) => product != null);

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker={`Member pricing · ${label}`} title="Member specials" crumb="Member specials">
        This month&apos;s member-only prices. New specials go live on the 1st and end when the month
        does.
      </PageIntro>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <p className="text-sm text-[#8f8c84]">
          <span className="mr-2 text-[1.6rem] font-semibold text-white">{days}</span>
          {days === 1 ? "day" : "days"} until new offers
        </p>
        <Link href="/club" className="btn">
          Join from {formatPrice(MEMBERSHIP_PRICE_CENTS / 100)}/mo
        </Link>
      </div>

      <p className="mb-6 text-sm text-[#8f8c84]">
        {offers.length} current offers. Prices shown are for active members.{" "}
        {MEMBER_DISCOUNT_PERCENT}% off, no codes at checkout.
      </p>

      <ul className="grid gap-4 sm:grid-cols-2">
        {offers.map((product) => {
          const regularCents = Math.round(product.minPrice * 100);
          const memberCents = memberUnitCents(regularCents);
          const saveCents = regularCents - memberCents;
          return (
            <li key={product.slug} className="surface p-5">
              <p className="text-[11px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
                Member only
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">{product.name}</h2>
              <dl className="mt-4 space-y-1 text-sm text-[#8f8c84]">
                <div className="flex justify-between gap-4">
                  <dt>Regular</dt>
                  <dd>{formatPrice(product.minPrice)}</dd>
                </div>
                <div className="flex justify-between gap-4 text-[#cfc8b8]">
                  <dt>Member price</dt>
                  <dd className="text-[#d4af37]">{formatPrice(memberCents / 100)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt>{MEMBER_DISCOUNT_PERCENT}% off</dt>
                  <dd>Save {formatPrice(saveCents / 100)}</dd>
                </div>
              </dl>
              {product.variants.length > 1 && (
                <p className="mt-3 text-xs leading-5 text-[#8f8c84]">
                  Shown on the lowest option. Every option is {MEMBER_DISCOUNT_PERCENT}% off.
                </p>
              )}
              <Link href={`/product/${product.slug}`} className="btn-ghost mt-4">
                View product
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
