import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { LEGAL_NAME, REGISTERED_COMPANY_DETAIL } from "@/lib/company";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "About",
  description:
    "Redline Labs is the trading name of RedlineLabs Limited (HK 80442501). Research-use laboratory chemicals with batch documentation available on request.",
  path: "/about",
});

export default function AboutPage() {
  return (
    <div>
      <section className="border-b border-[rgba(212,175,55,0.16)]">
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <ResearchDisclaimer className="mb-10" />
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
          <p className="kicker mb-3">About</p>
          <h1 className="mb-5 max-w-3xl text-[2.35rem] leading-[1.12] font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Research-use laboratory products, listed with clear information.
          </h1>
          <p className="max-w-2xl text-[16px] leading-8 text-[#8f8c84]">
            Redline Labs was established in 2026 with a focus on supplying
            research-use laboratory products with clear product information and
            batch documentation. The storefront is operated by {LEGAL_NAME}, a
            verified registered private corporation.
          </p>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)]">
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <div className="grid gap-4">
            <article className="surface p-6">
              <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
                Registered company
              </h2>
              <p className="text-[15px] leading-8 text-[#8f8c84]">
                {REGISTERED_COMPANY_DETAIL}
              </p>
            </article>
            <article className="surface p-6">
              <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
                Quality & Testing
              </h2>
              <p className="text-[15px] leading-8 text-[#8f8c84]">
                Where applicable, selected batches are independently tested
                through Janoshik Analytical, with testing documentation
                available for relevant products. Testing documentation may
                include information such as product identification, purity and
                measured content.
              </p>
            </article>
            <article className="surface p-6">
              <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
                Transparency
              </h2>
              <p className="text-[15px] leading-8 text-[#8f8c84]">
                We aim to provide clear product specifications and supporting
                documentation wherever available. Customers can contact us
                regarding available batch documentation for individual products
                at{" "}
                <a
                  href="mailto:redlinelabsltd@pm.me"
                  className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
                >
                  redlinelabsltd@pm.me
                </a>
                . Certificates of Analysis are not published on product pages.
                Lot numbers are not currently displayed on this site.
              </p>
            </article>
            <article className="surface p-6">
              <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
                Research Use Only
              </h2>
              <p className="text-[15px] leading-8 text-[#8f8c84]">
                All products supplied by Redline Labs are intended strictly for
                legitimate laboratory research and analytical purposes. They are
                not intended for human or veterinary consumption, diagnosis,
                treatment, or prevention of disease. This catalogue is not a
                pharmacy and does not offer medical advice.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap max-w-[860px] py-16 lg:py-20">
          <p className="kicker mb-3">Orders</p>
          <h2 className="section-title mb-4">Dispatch</h2>
          <p className="max-w-2xl text-[15px] leading-8 text-[#8f8c84]">
            The{" "}
            <Link
              href="/shipping-policy"
              className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
            >
              shipping policy
            </Link>{" "}
            states that orders are typically processed within 1–3 business days
            after payment confirmation, and that processing can take longer
            during high demand, holidays, or promotions. This storefront lists
            Australia-wide dispatch. Tracking may be sent once an order is
            processed, when the carrier provides it. Delivery dates are not
            guaranteed. Checkout collects an Australian shipping address through
            Stripe and does not offer shipping-method selection.
          </p>
        </div>
      </section>
    </div>
  );
}
