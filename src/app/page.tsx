import Image from "next/image";
import Link from "next/link";
import { NewsletterForm } from "@/components/NewsletterForm";
import { ProductCard } from "@/components/ProductCard";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { featuredProducts, premiumProducts } from "@/lib/products";

const facts = [
  {
    index: "01",
    title: "Research supply only",
    text: "Every listing is a laboratory research chemical, not a medicine or supplement.",
  },
  {
    index: "02",
    title: "Australia-wide dispatch",
    text: "The shipping policy currently states typical processing within 1–3 business days after payment.",
  },
  {
    index: "03",
    title: "Support by email",
    text: "Questions about SKUs, orders, or documentation: redlinelabsltd@pm.me",
  },
];

export default function Home() {
  const featured = featuredProducts();
  const premium = premiumProducts();

  return (
    <div>
      <section className="border-b border-[rgba(212,175,55,0.16)]">
        <div className="wrap pt-8">
          <ResearchDisclaimer />
        </div>
        <div className="wrap grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:py-20">
          <div>
            <p className="kicker mb-5">Laboratory research chemicals</p>
            <h1 className="mb-6 max-w-xl text-[2.35rem] leading-[1.15] font-semibold tracking-[-0.03em] text-white sm:text-5xl">
              Research peptides for laboratory use. Shipped within Australia.
            </h1>
            <p className="mb-9 max-w-lg text-[15px] leading-7 text-[#8f8c84]">
              Redline Labs lists compounds for qualified laboratory research.
              Certificates of Analysis are available on request. No product on
              this site is offered for human or veterinary use.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/shop" className="btn">
                View catalogue
              </Link>
              <Link href="/about" className="btn-outline">
                About the supplier
              </Link>
            </div>
          </div>
          <div className="surface relative mx-auto w-full max-w-[400px] px-8 py-10">
            <Image
              src="/brand/vial.png"
              alt="Redline Labs research vial"
              width={550}
              height={977}
              className="relative z-10 mx-auto h-auto w-full max-h-[420px] object-contain"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)]">
        <div className="wrap grid gap-0 md:grid-cols-3">
          {facts.map((item, i) => (
            <div
              key={item.title}
              className={`py-10 ${i > 0 ? "md:border-l md:border-[rgba(212,175,55,0.16)] md:pl-8" : ""} ${
                i < facts.length - 1 ? "border-b border-[rgba(212,175,55,0.16)] md:border-b-0" : ""
              }`}
            >
              <p className="mb-3 text-[11px] tracking-[0.16em] text-[#d4af37]">{item.index}</p>
              <h2 className="mb-2 text-[15px] font-medium text-white">{item.title}</h2>
              <p className="max-w-xs text-sm leading-6 text-[#8f8c84]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="py-20">
        <div className="wrap">
          <div className="mb-12 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="kicker mb-3">Catalogue</p>
              <h2 className="section-title">Selected products</h2>
              <p className="mt-2 text-sm text-[#8f8c84]">A short list from the current catalogue</p>
            </div>
            <Link href="/shop" className="btn-outline">
              View all
            </Link>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((item) => (
              <ProductCard key={item.listingKey} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.16)] py-20">
        <div className="wrap">
          <div className="mb-12">
            <p className="kicker mb-3">Further listings</p>
            <h2 className="section-title">More from the catalogue</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {premium.map((item) => (
              <ProductCard key={item.listingKey} item={item} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.16)] py-16">
        <div className="wrap max-w-[640px] text-center">
          <p className="kicker mb-3">Updates</p>
          <p className="mb-6 text-[15px] leading-7 text-[#cfc8b8]">
            Catalogue updates and availability notices. Research-use listings
            only.
          </p>
          <NewsletterForm />
        </div>
      </section>
    </div>
  );
}
