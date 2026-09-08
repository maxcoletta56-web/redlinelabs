import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  IconBeaker,
  IconLock,
  IconMicroscope,
  IconShield,
  IconStar,
  IconTruck,
} from "@/components/Icons";
import { featuredProducts } from "@/lib/products";

const trustItems = [
  { icon: IconTruck, title: "Nationwide dispatch", text: "Processed promptly for Australian delivery." },
  { icon: IconBeaker, title: "Verified quality", text: "Handled to consistent research-grade standards." },
  { icon: IconShield, title: "Secure packaging", text: "Packed to protect integrity in transit." },
  { icon: IconLock, title: "Protected checkout", text: "Orders placed through an encrypted flow." },
];

const stats = [
  { value: "99%", label: "Purity standard" },
  { value: "24H", label: "Dispatch target" },
  { value: "1000+", label: "Orders fulfilled" },
  { value: "5.0", label: "Service rating" },
];

const reasons = [
  {
    icon: IconMicroscope,
    title: "Research-grade supply",
    text: "Materials are prepared to strict handling standards so laboratories can work with consistent, dependable stock.",
  },
  {
    icon: IconBeaker,
    title: "Documented quality focus",
    text: "Each batch follows defined quality procedures so researchers can order with confidence.",
  },
  {
    icon: IconTruck,
    title: "Professional fulfillment",
    text: "Orders are packed carefully and processed promptly to keep procurement simple.",
  },
];

const audience = [
  {
    n: "01",
    title: "Research laboratories",
    text: "Analytical and scientific teams that need reliable materials for controlled studies.",
  },
  {
    n: "02",
    title: "Biotech groups",
    text: "Specialists requiring premium research-grade supply and responsive support.",
  },
  {
    n: "03",
    title: "Analytical scientists",
    text: "Investigators running structured testing programmes and method development.",
  },
  {
    n: "04",
    title: "Research institutions",
    text: "Universities and qualified organisations conducting educational research.",
  },
];

const reviews = [
  {
    quote:
      "Exceptional quality and professional packaging. The ordering process was smooth from start to finish.",
    name: "James M.",
  },
  {
    quote:
      "Fast dispatch and excellent communication. Highly impressed with the overall experience.",
    name: "Michael T.",
  },
  {
    quote:
      "Clean branding, premium packaging and outstanding attention to detail.",
    name: "Sarah K.",
  },
  {
    quote: "One of the most professional suppliers I have worked with recently.",
    name: "Daniel R.",
  },
];

export default function Home() {
  const featured = featuredProducts();
  const looped = [...reviews, ...reviews];

  return (
    <div>
      <section className="hero-grid relative overflow-hidden border-b border-[rgba(212,175,55,0.12)]">
        <div className="mx-auto grid max-w-[1280px] items-center gap-12 px-5 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
          <div>
            <p className="mb-5 inline-flex border border-[#d4af37]/70 px-3 py-1 text-[10px] font-medium tracking-[0.22em] text-[#d4af37] uppercase">
              Research use only · Sterile filtered
            </p>
            <p className="mb-3 text-[13px] tracking-[0.28em] text-[#d8d8d8] uppercase">
              Premium sterile supply
            </p>
            <h1 className="gold-text mb-6 max-w-xl text-[46px] leading-[1.05] font-semibold tracking-tight sm:text-6xl">
              Precision materials for serious research.
            </h1>
            <p className="mb-9 max-w-lg text-[15px] leading-8 text-[#c8c8c8]">
              Redline Labs supplies laboratory-grade compounds with consistent
              handling, professional packaging, and Australia-wide dispatch.
              Built for teams that need reliability, not theatrics.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/shop"
                className="inline-flex items-center bg-[#d4af37] px-6 py-3.5 text-[11px] font-semibold tracking-[0.16em] text-black uppercase transition hover:bg-[#f0d78a]"
              >
                Browse catalogue
              </Link>
              <Link
                href="/about"
                className="inline-flex items-center border border-[#d4af37] px-6 py-3.5 text-[11px] font-semibold tracking-[0.16em] text-[#d4af37] uppercase transition hover:bg-[rgba(212,175,55,0.08)]"
              >
                Our standards
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute inset-10 rounded-full bg-[#d4af37]/12 blur-3xl" />
            <Image
              src="/brand/vial.png"
              alt="Redline Labs sterile filtered vial"
              width={550}
              height={977}
              className="relative z-10 mx-auto h-auto w-full object-contain"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.12)] bg-[#080808] px-5 py-10">
        <div className="mx-auto grid max-w-[1280px] gap-px bg-[rgba(212,175,55,0.12)] sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div key={item.title} className="bg-[#080808] px-6 py-7">
              <div className="mb-4 text-[#d4af37]">
                <item.icon className="h-6 w-6" />
              </div>
              <h2 className="mb-2 text-sm font-semibold tracking-wide text-white">
                {item.title}
              </h2>
              <p className="text-sm leading-6 text-[#b5b5b5]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1280px]">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-[11px] tracking-[0.24em] text-[#d4af37] uppercase">
                Featured catalogue
              </p>
              <h2 className="text-3xl font-semibold tracking-tight">
                Selected research compounds
              </h2>
            </div>
            <Link
              href="/shop"
              className="text-[12px] font-medium tracking-[0.16em] text-[#d4af37] uppercase"
            >
              View all 30 products →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(212,175,55,0.12)] bg-[#080808] px-5 py-20">
        <div className="mx-auto grid max-w-[1280px] items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-[11px] font-medium tracking-[0.24em] text-[#d4af37] uppercase">
              Research excellence
            </p>
            <h2 className="mb-5 text-4xl font-semibold leading-tight tracking-tight">
              A quieter standard of quality.
            </h2>
            <p className="max-w-xl text-[15px] leading-8 text-[#c4c4c4]">
              Precision, consistency, and care sit behind every order. We focus
              on premium research materials, defined quality procedures, and
              fulfillment that feels considered rather than rushed.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-px bg-[rgba(212,175,55,0.14)]">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#080808] px-8 py-10 text-center">
                <h3 className="text-4xl font-semibold text-[#d4af37]">{stat.value}</h3>
                <span className="mt-2 block text-sm text-[#d8d8d8]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="mb-12 text-center text-3xl font-semibold tracking-tight">
            Why laboratories choose Redline
          </h2>
          <div className="grid gap-10 md:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.title}>
                <div className="mb-4 text-[#d4af37]">
                  <reason.icon className="h-6 w-6" />
                </div>
                <h3 className="mb-3 text-lg font-semibold">{reason.title}</h3>
                <p className="text-sm leading-7 text-[#b8b8b8]">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-[1280px]">
          <p className="mb-2 text-[11px] tracking-[0.24em] text-[#d4af37] uppercase">
            Who we serve
          </p>
          <h2 className="mb-10 text-3xl font-semibold tracking-tight">
            Built for serious research
          </h2>
          <div className="grid gap-px bg-[rgba(212,175,55,0.14)] md:grid-cols-2 xl:grid-cols-4">
            {audience.map((card) => (
              <article key={card.title} className="bg-[#050505] p-7">
                <p className="mb-5 text-[11px] tracking-[0.22em] text-[#d4af37]">
                  {card.n}
                </p>
                <h3 className="mb-3 text-xl font-semibold">{card.title}</h3>
                <p className="text-sm leading-7 text-[#b8b8b8]">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden border-t border-[rgba(212,175,55,0.12)] py-20">
        <div className="mb-10 px-5 text-center">
          <p className="mb-2 text-[11px] tracking-[0.24em] text-[#d4af37] uppercase">
            Client notes
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">What researchers report</h2>
        </div>
        <div className="flex w-max gap-5 px-5 marquee-track">
          {looped.map((review, i) => (
            <article
              key={`${review.name}-${i}`}
              className="w-[340px] min-w-[340px] border border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] p-8"
            >
              <div className="mb-5 flex gap-1 text-[#d4af37]">
                {Array.from({ length: 5 }).map((_, s) => (
                  <IconStar key={s} className="h-3.5 w-3.5" />
                ))}
              </div>
              <p className="mb-6 text-sm leading-7 text-[#d2d2d2]">{review.quote}</p>
              <p className="text-sm font-medium">{review.name}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.12)] bg-[#080808] px-5 py-16">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="mb-2 text-[11px] tracking-[0.24em] text-[#d4af37] uppercase">
              Subscriber offer
            </p>
            <h2 className="text-2xl font-semibold">15% off Retatrutide</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-[#b8b8b8]">
              Join the list for availability updates, new releases, and occasional
              research catalogue offers.
            </p>
          </div>
          <form className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="Email address"
              className="flex-1 border border-[rgba(212,175,55,0.28)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <button className="bg-[#d4af37] px-5 py-3 text-[11px] font-semibold tracking-[0.16em] text-black uppercase">
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
