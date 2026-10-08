import type { Metadata } from "next";
import Link from "next/link";
import { ClubJoinForm } from "@/components/ClubJoinForm";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import {
  CLUB_TIERS,
  FIRST_ORDER_BONUS_POINTS,
  JOIN_BONUS_POINTS,
  REDEEM_STEP_POINTS,
  formatCents,
  percentBack,
  pointsValueCents,
  type ClubTier,
} from "@/lib/club";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Redline Club",
  description:
    "Join the Redline Club: free membership, 100 welcome points, and points on every paid order. Four tiers by lifetime spend, from 5% back up to 10% back in points.",
  path: "/club",
});

function earnRate(tier: ClubTier) {
  const perDollar = tier.earnBasis / 100;
  const rate = String(Number(perDollar.toFixed(2)));
  return `${rate} ${perDollar === 1 ? "point" : "points"} per $1`;
}

function TierCard({ tier, top, wide }: { tier: ClubTier; top: boolean; wide?: boolean }) {
  return (
    <li className={`surface relative p-5${wide ? " sm:col-span-2" : ""}`}>
      {top && (
        <span className="absolute top-4 right-4 rounded-full border border-[rgba(212,175,55,0.34)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
          Top tier
        </span>
      )}
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
        {tier.name}
      </p>
      <p className="mt-2 text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-white">
        {percentBack(tier)}% back
      </p>
      <p className="mt-2 text-sm text-[#d4af37]">{earnRate(tier)}</p>
      <p className="mt-1 text-xs text-[#8f8c84]">
        {tier.fromCents === 0
          ? "From your first order"
          : `From ${formatCents(tier.fromCents)} lifetime spend`}
      </p>
    </li>
  );
}

export default function ClubPage() {
  const steps = [
    {
      title: "Join free",
      body: `We add ${JOIN_BONUS_POINTS} points — ${formatCents(
        pointsValueCents(JOIN_BONUS_POINTS),
      )} — to your balance straight away, and another ${FIRST_ORDER_BONUS_POINTS} once your first order is paid.`,
    },
    {
      title: "Earn on every paid order",
      body: "Order with your membership email and points land when your payment clears. Spend more over time and the earn rate goes up with your tier.",
    },
    {
      title: "Spend points at checkout",
      body: `${REDEEM_STEP_POINTS} points is ${formatCents(
        pointsValueCents(REDEEM_STEP_POINTS),
      )} off. Apply them in the checkout summary with your email and member code.`,
    },
  ];

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Club" title="Welcome to the club" crumb="Club">
        The more you order, the more comes back. Membership is free, points are earned on every
        paid order, and your tier rises with your lifetime spend.
      </PageIntro>

      <ul className="mb-12 grid gap-4 sm:grid-cols-2">
        {CLUB_TIERS.map((tier, index) => (
          <TierCard
            key={tier.id}
            tier={tier}
            top={index === CLUB_TIERS.length - 1}
            wide={index === CLUB_TIERS.length - 1 && CLUB_TIERS.length % 2 === 1}
          />
        ))}
      </ul>

      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        <section aria-labelledby="club-how">
          <h2 id="club-how" className="mb-5 text-[13px] font-semibold tracking-[0.12em] uppercase">
            How it works
          </h2>
          <ol className="space-y-5">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[rgba(212,175,55,0.34)] text-xs text-[#d4af37]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[15px] font-medium text-white">{step.title}</p>
                  <p className="mt-1 text-sm leading-7 text-[#8f8c84]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <h2
            id="club-rules"
            className="mt-10 mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase"
          >
            The fine print
          </h2>
          <ul className="space-y-2 text-sm leading-7 text-[#8f8c84]">
            <li>
              {REDEEM_STEP_POINTS} points = {formatCents(pointsValueCents(REDEEM_STEP_POINTS))}.
              Points are redeemed in blocks of {REDEEM_STEP_POINTS}.
            </li>
            <li>
              Points are earned on the amount you actually pay, after any coupon or points you
              applied, and are added once payment clears.
            </li>
            <li>Tiers are set by lifetime paid spend and never go down.</li>
            <li>
              Points have no cash value, cannot be transferred, and an order always keeps at least
              {" "}
              {formatCents(100)} payable.
            </li>
            <li>
              Your member code is how your balance is protected — keep it to yourself, and email us
              if you lose it.
            </li>
          </ul>
        </section>

        <aside>
          <h2 className="mb-5 text-[13px] font-semibold tracking-[0.12em] uppercase">
            Join the club
          </h2>
          <ClubJoinForm />
          <p className="mt-4 text-sm leading-7 text-[#8f8c84]">
            Already a member?{" "}
            <Link href="/club/balance" className="text-[#d4af37]">
              Check your points balance
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  );
}
