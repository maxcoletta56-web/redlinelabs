import type { Metadata } from "next";
import Link from "next/link";
import { ClubJoinForm } from "@/components/ClubJoinForm";
import { PageIntro } from "@/components/PageIntro";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import {
  CLUB_PROGRAM,
  MIN_PAYABLE_CENTS,
  REDEEM_STEP_POINTS,
  activeClubProgram,
  formatCents,
  tierCardLabel,
  type ClubTierConfig,
} from "@/lib/club";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Redline Club",
  description:
    "Join the Redline Club: free membership with a personal member code, four tiers set by lifetime spend, and points on paid orders once programme rates are published.",
  path: "/club",
});

function earnRate(tier: ClubTierConfig) {
  if (!tier.earnBasis) return "Earn rate to be confirmed";
  const perDollar = tier.earnBasis / 100;
  const rate = String(Number(perDollar.toFixed(2)));
  return `${rate} ${perDollar === 1 ? "point" : "points"} per $1`;
}

function threshold(tier: ClubTierConfig, index: number) {
  if (index === 0) return "From your first order";
  if (tier.fromCents === null) return "Spend threshold to be confirmed";
  return `From ${formatCents(tier.fromCents)} lifetime spend`;
}

function TierCard({
  tier,
  index,
  top,
  wide,
}: {
  tier: ClubTierConfig;
  index: number;
  top: boolean;
  wide?: boolean;
}) {
  return (
    <li className={`surface relative p-5${wide ? " sm:col-span-2" : ""}`}>
      {top && (
        <span className="absolute top-4 right-4 rounded-full border border-[rgba(212,175,55,0.34)] px-2 py-0.5 text-[10px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
          Top tier
        </span>
      )}
      <p className="text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
        {tierCardLabel(tier, index)}
      </p>
      <p className="mt-2 text-[1.5rem] leading-none font-semibold tracking-[-0.02em] text-white">
        {earnRate(tier)}
      </p>
      <p className="mt-2 text-xs text-[#8f8c84]">{threshold(tier, index)}</p>
    </li>
  );
}

export default function ClubPage() {
  const program = activeClubProgram();
  const tiers = CLUB_PROGRAM.tiers;
  const steps = [
    {
      title: "Join free",
      body: "Enter your email and we issue a personal member code. It is shown once and only a hash of it is kept, so save it somewhere safe.",
    },
    {
      title: "Earn on paid orders",
      body: program
        ? "Order with your membership email and points land when your payment clears. Spend more over time and the earn rate goes up with your tier."
        : "Order with your membership email. Points start landing on paid orders once the programme rates are published; joining now does not earn anything backdated.",
    },
    {
      title: "Spend points at checkout",
      body: program
        ? `${REDEEM_STEP_POINTS} points is ${formatCents(program.centsPerRedeemBlock)} off. Apply them in the checkout summary with your email and member code.`
        : "Redemption opens together with earning. It will use your email and member code in the checkout summary.",
    },
  ];

  return (
    <div className="wrap max-w-[980px] py-16">
      <ResearchDisclaimer className="mb-10" />
      <PageIntro kicker="Redline Club" title="Welcome to the club" crumb="Club">
        Membership is free. Points are earned on paid orders and your tier follows your lifetime
        spend.
      </PageIntro>

      {!program && (
        <p
          className="mb-8 border border-[rgba(212,175,55,0.34)] px-4 py-3 text-sm leading-6 text-[#cfc8b8]"
          role="note"
        >
          Earn rates and the points value are still being finalised,
          so points are not being earned or redeemed yet. You can join now to get your member code.
        </p>
      )}

      <ul className="mb-12 grid gap-4 sm:grid-cols-2">
        {tiers.map((tier, index) => (
          <TierCard
            key={index}
            tier={tier}
            index={index}
            top={index === tiers.length - 1}
            wide={index === tiers.length - 1 && tiers.length % 2 === 1}
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
            <li>Points are redeemed in blocks of {REDEEM_STEP_POINTS}.</li>
            <li>
              Points are earned on the amount you actually pay, after any coupon or points you
              applied, and are added once payment clears.
            </li>
            <li>
              Points have no cash value, cannot be transferred, and an order always keeps at least{" "}
              {formatCents(MIN_PAYABLE_CENTS)} payable. Points applied to an order that is
              cancelled before payment are returned.
            </li>
            <li>
              Your email identifies your earnings. Your member code is what protects your balance —
              keep it to yourself. We cannot show it again.
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
