import type { Metadata } from "next";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  IconLock,
  IconMail,
  IconPin,
  IconShield,
  IconTruck,
} from "@/components/Icons";
import { COMPANY_NUMBER, REGISTERED_COMPANY_SHORT } from "@/lib/company";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { faqs } from "@/lib/faqs";
import {
  categories,
  featuredProducts,
  formatPrice,
  getProduct,
  products,
  productsBySlugs,
} from "@/lib/products";
import { pageMetadata } from "@/lib/seo";

const FaqList = dynamic(() => import("@/components/FaqList").then((mod) => mod.FaqList));

export const metadata: Metadata = pageMetadata({
  title: "Redline Labs | Research chemicals, Australia",
  description:
    "Redline Labs lists laboratory research chemicals for purchase in Australia. Certificates of analysis on request. Research use only, not a pharmacy.",
  path: "/",
  absoluteTitle: true,
});

const heroSlugs = ["ghk-cu", "bpc-157", "retatrutide"] as const;

const steps = [
  {
    n: "01",
    title: "Browse the catalogue",
    text: "Open a listing for chemical identity, size options where published, and the listed AUD price.",
  },
  {
    n: "02",
    title: "Place an order",
    text: "Add items to the cart and complete checkout. Research-use confirmation is required.",
  },
  {
    n: "03",
    title: "Dispatch after payment",
    text: "Orders are typically processed within 1–3 business days after payment confirmation, per the shipping policy.",
  },
];

const categoryCopy: Record<string, string> = {
  "GLP-1 RESEARCH": "Incretin-related research compounds listed in this catalogue.",
  "TISSUE RESEARCH": "Compounds grouped here for tissue-response laboratory literature.",
  "GROWTH SUPPORT": "GHRH analogues and ghrelin-receptor research listings.",
  "BRAIN-PERFORMANCE": "Neuropeptide research chemicals from the current catalogue.",
  ENERGY: "Mitochondrial and metabolic research listings.",
  REPRODUCTIVE: "Gonadotropin-related research listings.",
  BLENDS: "Multi-compound research blends. Confirm constituents on the vial label.",
  "MELANOCORTIN RESEARCH": "Melanocortin-receptor research listings.",
  ACCESSORIES: "Laboratory solvents listed alongside the research catalogue.",
};

export default function Home() {
  const featured = featuredProducts();
  const hero = productsBySlugs([...heroSlugs]);
  const activeHero = getProduct("bpc-157") ?? hero[0];
  const shopCategories = categories.filter((c) => c !== "All");
  const tickerNames = products.map((p) => p.name);

  return (
    <div>
      <section className="relative overflow-hidden bg-[#050505] text-white">
        <Image
          src="/brand/hero-lab.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-black/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
        <div className="wrap relative z-10 grid items-center gap-10 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="mb-5 text-[11px] font-semibold tracking-[0.18em] text-[#d4af37] uppercase">
              — Research catalogue · Australia · Registered company
            </p>
            <h1 className="mb-6 max-w-xl text-[3rem] leading-[0.95] font-extrabold tracking-[-0.05em] sm:text-6xl lg:text-[4.25rem]">
              Research-Grade
              <span className="mt-1 block text-[#d4af37]">Peptides & Compounds</span>
            </h1>
            <p className="mb-8 max-w-lg text-[16px] leading-7 text-[#cfc8b8]">
              Redline Labs lists laboratory research chemicals for purchase in
              Australia. Certificates of Analysis are available on request. This
              is not a pharmacy. Operated by a verified registered private
              corporation in Hong Kong.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/shop" className="btn">
                Explore research peptides
              </Link>
              <Link href="/about" className="btn-outline">
                About / documentation
              </Link>
            </div>
          </div>
          <div className="relative mx-auto hidden min-h-[340px] w-full max-w-[520px] md:block lg:min-h-[380px] lg:max-w-none">
            {hero.map((product, i) => (
              <div
                key={product.slug}
                className={`absolute ${
                  i === 1
                    ? "right-6 top-2 z-20 w-[220px]"
                    : i === 0
                      ? "left-4 top-16 z-10 w-[160px]"
                      : "bottom-8 right-28 z-10 w-[150px]"
                }`}
              >
                <ProductImage
                  src={product.image}
                  alt={`${product.name} research vial`}
                  width={440}
                  height={440}
                  className="h-auto w-full object-contain drop-shadow-2xl"
                  priority={i === 1}
                />
              </div>
            ))}
            {activeHero && (
              <div className="absolute right-0 bottom-0 left-0 rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-[11px] tracking-[0.08em] text-[#cfc8b8] uppercase backdrop-blur-sm">
                {activeHero.name} · from {formatPrice(activeHero.minPrice)} · COA on request
              </div>
            )}
          </div>
        </div>
        <div className="relative z-10 border-t border-white/10 bg-black/55">
          <div className="wrap grid grid-cols-2 gap-6 py-6 sm:grid-cols-4">
            {[
              { label: `${products.length} listings`, detail: "Current catalogue" },
              { label: "COA on request", detail: "Not published on pages" },
              { label: "1–3 business days", detail: "Typical processing" },
              { label: "Australia-wide", detail: "Dispatch as published" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[15px] font-semibold tracking-[-0.02em]">{item.label}</p>
                <p className="text-[11px] tracking-[0.12em] text-[#8f8c84] uppercase">{item.detail}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-white/10 py-3">
            <div
              className="marquee text-[12px] tracking-[0.12em] text-[#8f8c84] uppercase"
              aria-label="Catalogue compound names"
            >
              <div className="marquee-track">
                {[0, 1].map((copy) => (
                  <div
                    className="marquee-group"
                    key={copy}
                    aria-hidden={copy === 1 ? true : undefined}
                  >
                    {tickerNames.map((name) => (
                      <span key={`${copy}-${name}`}>
                        <span className="mr-2 text-[#d4af37]">•</span>
                        {name}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#050505]">
        <div className="wrap grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: IconTruck, title: "Australia-wide dispatch", text: "Typical processing within 1–3 business days after payment." },
            { icon: IconMail, title: "COA on request", text: "Email the product name and SKU. Lot numbers are not shown here." },
            { icon: IconShield, title: "Research use only", text: "Not medicines, supplements, or products for human use." },
            { icon: IconPin, title: "Email support", text: "redlinelabsltd@pm.me" },
          ].map((item) => (
            <div key={item.title}>
              <div className="mb-3 text-[#d4af37]">
                <item.icon className="h-7 w-7" />
              </div>
              <h2 className="mb-1 text-[16px] font-semibold">{item.title}</h2>
              <p className="text-[14px] leading-6 text-[#8f8c84]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#0b0b0b] py-8">
        <div className="wrap grid gap-4 lg:grid-cols-2">
          <aside className="flex gap-4 rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] p-5" role="note">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
              <IconLock className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Research use only</p>
              <p className="mt-1 text-[14px] leading-6 text-[#8f8c84]">
                All listings are laboratory research chemicals. They are not
                medicines, not for human or animal consumption, and are not sold
                for personal use.
              </p>
            </div>
          </aside>
          <aside className="flex gap-4 rounded-2xl border border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#d4af37]/10 text-[#d4af37]">
              <IconShield className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold">Verified registered company</p>
              <p className="mt-1 text-[14px] leading-6 text-[#8f8c84]">
                {REGISTERED_COMPANY_SHORT} Company number {COMPANY_NUMBER}. Details are
                on the{" "}
                <Link href="/about" className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3">
                  About
                </Link>{" "}
                page.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="bg-[#0b0b0b] py-16 lg:py-20">
        <div className="wrap">
          <div className="mb-12 text-center">
            <p className="kicker mb-3">Featured</p>
            <h2 className="section-title">Selected research compounds</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#8f8c84]">
              A short list from the current catalogue. Confirm identity against
              the vial label and any documentation you hold.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop" className="btn">
              View all research compounds →
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-16 lg:py-20">
        <div className="wrap">
          <div className="mb-12 text-center">
            <p className="kicker mb-3">Catalogue</p>
            <h2 className="section-title">Research domains in this shop</h2>
            <p className="mx-auto mt-3 max-w-xl text-[15px] text-[#8f8c84]">
              Listings are grouped by the categories published on this site. No
              purity standard is claimed here.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {shopCategories.map((cat, index) => {
              const names = products
                .filter((p) => p.categories.includes(cat))
                .map((p) => p.name)
                .slice(0, 4);
              const extra =
                products.filter((p) => p.categories.includes(cat)).length - names.length;
              return (
                <article key={cat} className="surface flex flex-col p-6 transition duration-200 hover:-translate-y-0.5 hover:border-[#d4af37]/50">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[20px] font-semibold tracking-[-0.03em]">{cat.split(" / ")[0]}</h3>
                      <p className="mt-1 text-[11px] tracking-[0.12em] text-[#d4af37] uppercase">
                        {cat}
                      </p>
                    </div>
                    <span className="rounded-full border border-[rgba(212,175,55,0.34)] px-3 py-1 text-[13px] font-semibold tracking-[0.08em] text-[#d4af37]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <p className="mb-5 text-[14px] leading-6 text-[#8f8c84]">
                    {categoryCopy[cat]}
                  </p>
                  <ul className="mb-5 space-y-1.5 text-[14px] text-[#cfc8b8]">
                    {names.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                    {extra > 0 && (
                      <li className="text-[#8f8c84]">+{extra} more</li>
                    )}
                  </ul>
                  <Link
                    href={`/shop?category=${encodeURIComponent(cat)}`}
                    className="mt-auto text-[12px] font-semibold tracking-[0.08em] text-[#d4af37] uppercase"
                  >
                    Browse this category →
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-16 text-white lg:py-20">
        <div className="wrap">
          <div className="mb-10 text-center">
            <p className="kicker mb-3">Documentation</p>
            <h2 className="text-[2.1rem] font-bold tracking-[-0.04em] text-white">
              What this site publishes
            </h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <article className="rounded-2xl border border-white/10 bg-white/5 p-8">
              <h3 className="mb-3 text-[1.5rem] font-semibold">COAs are not on product pages.</h3>
              <p className="mb-6 text-[15px] leading-7 text-[#cfc8b8]">
                A Certificate of Analysis is a batch document. On this site, batch
                COAs are available on request by email for relevant products.
                Lot numbers are not currently displayed. Where applicable,
                selected batches are independently tested through Janoshik
                Analytical.
              </p>
              <Link href="/about" className="btn">
                Read the documentation notes →
              </Link>
            </article>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { title: "Request by SKU", text: "Email redlinelabsltd@pm.me with the product name and SKU." },
                { title: "Not a clinical claim", text: "A COA is not a licence, approval, or use instruction." },
                { title: "Identity on the vial", text: "Confirm sequence and form against the label you receive." },
                { title: "Selected batches", text: "Where applicable, selected batches are tested through Janoshik Analytical." },
              ].map((item) => (
                <article key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h3 className="mb-2 text-[15px] font-semibold">{item.title}</h3>
                  <p className="text-[13px] leading-6 text-[#8f8c84]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] py-16 lg:py-20">
        <div className="wrap">
          <div className="mb-12 text-center">
            <p className="kicker mb-3">How it works</p>
            <h2 className="section-title">Three simple steps</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((step) => (
              <article key={step.n}>
                <div className="mb-5 flex h-16 w-16 items-center justify-center bg-[#d4af37] text-black">
                  <span className="text-lg font-semibold">{step.n}</span>
                </div>
                <p className="mb-2 text-[12px] tracking-[0.14em] text-[#d4af37]">{step.n}</p>
                <h3 className="mb-2 text-[20px] font-semibold">{step.title}</h3>
                <p className="text-[14px] leading-6 text-[#8f8c84]">{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#0b0b0b] py-16 lg:py-20">
        <div className="wrap max-w-[760px]">
          <div className="mb-10 text-center">
            <p className="kicker mb-3">FAQ</p>
            <h2 className="section-title">Common questions answered</h2>
          </div>
          <FaqList items={faqs} headingLevel="h3" />
          <p className="mt-6 text-center">
            <Link href="/faq" className="text-[14px] font-medium text-[#d4af37]">
              View all frequently asked questions →
            </Link>
          </p>
        </div>
      </section>

      <section className="bg-[#050505] py-10">
        <div className="wrap">
          <div className="overflow-hidden border border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] px-6 py-16 text-center text-white sm:px-12">
            <p className="kicker mb-3">Get started</p>
            <h2 className="mx-auto mb-4 max-w-2xl text-[2.2rem] leading-tight font-bold tracking-[-0.04em] sm:text-5xl">
              Explore the Redline{" "}
              <span className="text-[#d4af37]">research catalogue.</span>
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-[15px] leading-7 text-[#cfc8b8]">
              Browse the catalogue, or read how documentation is handled on this
              site. Research use only.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link href="/shop" className="btn">
                Browse the catalogue →
              </Link>
              <Link href="/about" className="btn-outline">
                Documentation notes
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
