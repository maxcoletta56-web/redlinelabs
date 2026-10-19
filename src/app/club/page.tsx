import type { Metadata } from "next";
import Link from "next/link";
import { ClubJoinForm } from "@/components/ClubJoinForm";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { MEMBERSHIP_PRICE_CENTS } from "@/lib/membership";
import { formatPrice } from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Redline Membership",
  description:
    "Redline VIP Membership is $50 a month. Members get automatic pricing on selected products, refreshed on the 1st. Cancel anytime.",
  path: "/club",
});

const benefits = [
  "Exclusive member-only pricing on selected products every month",
  "Discounts apply automatically — no codes needed",
  "New offers refresh monthly",
  "Cancel anytime — access continues until the end of the period you have paid",
];

export default function ClubPage() {
  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Membership" title="Redline VIP Membership" crumb="Membership">
        Member-only prices on a short list of products, refreshed on the 1st of each month.
      </PageIntro>

      <div className="mb-12 grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="surface p-6" aria-labelledby="membership-price">
          <p id="membership-price" className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
            VIP Membership
          </p>
          <p className="mt-3 text-[2.4rem] leading-none font-semibold tracking-[-0.03em] text-white">
            {price}
            <span className="ml-2 text-base font-medium text-[#8f8c84]">/ month</span>
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
          <p className="mt-6 text-sm leading-7 text-[#8f8c84]">
            This month&apos;s prices are on the{" "}
            <Link href="/club/specials" className="text-[#d4af37]">
              member specials
            </Link>{" "}
            page. They apply when the checkout email has an active membership.
          </p>
        </section>

        <aside>
          <h2 className="mb-5 text-[13px] font-semibold tracking-[0.12em] uppercase">
            Get started
          </h2>
          <ClubJoinForm />
          <p className="mt-4 text-sm leading-7 text-[#8f8c84]">
            Already a member?{" "}
            <Link href="/club/balance" className="text-[#d4af37]">
              Check your membership
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
