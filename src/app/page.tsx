import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  IconBeaker,
  IconLock,
  IconMicroscope,
  IconShield,
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

  return (
    <div>
      <section className="hero-grid border-b border-[rgba(212,175,55,0.12)]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <p className="kicker mb-6">Research use only · Sterile filtered</p>
            <h1 className="font-serif mb-6 max-w-xl text-5xl leading-[1.08] font-medium tracking-tight text-[#f4f1e8] sm:text-6xl">
              Precision materials for serious research.
            </h1>
            <p className="mb-10 max-w-lg text-[16px] leading-8 text-[#a7a193]">
              Redline Labs supplies laboratory-grade compounds with consistent
              handling, considered packaging, and Australia-wide dispatch.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop" className="btn">
                Browse catalogue
              </Link>
              <Link href="/about" className="btn-outline">
                Our standards
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[380px]">
            <div className="absolute inset-12 rounded-full bg-[#d4af37]/10 blur-3xl" />
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

      <section className="border-b border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-5">
        <div className="mx-auto grid max-w-[1200px] sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item, i) => (
            <div
              key={item.title}
              className={`px-6 py-8 ${i > 0 ? "lg:border-l lg:border-[rgba(212,175,55,0.12)]" : ""}`}
            >
              <div className="mb-4 text-[#d4af37]">
                <item.icon className="h-5 w-5" />
              </div>
              <h2 className="mb-2 text-sm font-medium tracking-wide text-[#f4f1e8]">
                {item.title}
              </h2>
              <p className="text-sm leading-6 text-[#a7a193]">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1200px]">
          <div className="mb-12 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="kicker mb-3">Featured catalogue</p>
              <h2 className="font-serif text-4xl font-medium tracking-tight">
                Selected research compounds
              </h2>
            </div>
            <Link href="/shop" className="text-[12px] tracking-[0.14em] text-[#d4af37] uppercase">
              View full catalogue
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-5 py-20">
        <div className="mx-auto grid max-w-[1200px] items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="kicker mb-4">Quality</p>
            <h2 className="font-serif mb-5 text-4xl font-medium leading-tight tracking-tight">
              A considered standard of supply.
            </h2>
            <p className="max-w-xl text-[15px] leading-8 text-[#a7a193]">
              Precision and consistency sit behind every order. We focus on
              defined quality procedures and fulfillment that feels orderly
              rather than rushed.
            </p>
          </div>
          <div className="grid grid-cols-2 border border-[rgba(212,175,55,0.14)]">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`px-8 py-10 ${i % 2 === 1 ? "border-l border-[rgba(212,175,55,0.14)]" : ""} ${
                  i > 1 ? "border-t border-[rgba(212,175,55,0.14)]" : ""
                }`}
              >
                <h3 className="font-serif text-4xl font-medium text-[#d4af37]">{stat.value}</h3>
                <span className="mt-2 block text-sm text-[#cfc8b8]">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="font-serif mb-14 text-center text-4xl font-medium tracking-tight">
            Why laboratories choose Redline
          </h2>
          <div className="grid gap-12 md:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.title}>
                <div className="mb-4 text-[#d4af37]">
                  <reason.icon className="h-5 w-5" />
                </div>
                <h3 className="font-serif mb-3 text-2xl font-medium">{reason.title}</h3>
                <p className="text-sm leading-7 text-[#a7a193]">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-20">
        <div className="mx-auto max-w-[1200px]">
          <p className="kicker mb-3">Who we serve</p>
          <h2 className="font-serif mb-10 text-4xl font-medium tracking-tight">
            Built for serious research
          </h2>
          <div className="grid border border-[rgba(212,175,55,0.14)] md:grid-cols-2 xl:grid-cols-4">
            {audience.map((card, i) => (
              <article
                key={card.title}
                className={`p-7 ${i > 0 ? "border-t border-[rgba(212,175,55,0.14)] xl:border-t-0 xl:border-l" : ""}`}
              >
                <p className="mb-5 text-[11px] tracking-[0.2em] text-[#d4af37]">{card.n}</p>
                <h3 className="font-serif mb-3 text-2xl font-medium">{card.title}</h3>
                <p className="text-sm leading-7 text-[#a7a193]">{card.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.12)] px-5 py-20">
        <div className="mx-auto max-w-[1200px]">
          <p className="kicker mb-3 text-center">Client notes</p>
          <h2 className="font-serif mb-12 text-center text-4xl font-medium tracking-tight">
            What researchers report
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {reviews.map((review) => (
              <article
                key={review.name}
                className="border border-[rgba(212,175,55,0.14)] bg-[#0a0a0a] p-7"
              >
                <p className="mb-6 text-sm leading-7 text-[#d5d0c4]">“{review.quote}”</p>
                <p className="text-sm text-[#d4af37]">{review.name}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.12)] bg-[#0a0a0a] px-5 py-16">
        <div className="mx-auto flex max-w-[1200px] flex-col items-start justify-between gap-8 md:flex-row md:items-center">
          <div>
            <p className="kicker mb-3">Updates</p>
            <h2 className="font-serif text-3xl font-medium">Stay informed</h2>
            <p className="mt-2 max-w-md text-sm leading-7 text-[#a7a193]">
              Availability notices, new catalogue releases, and occasional
              subscriber offers including 15% off Retatrutide.
            </p>
          </div>
          <form className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
            <input type="email" required placeholder="Email address" className="field" />
            <button className="btn shrink-0">Subscribe</button>
          </form>
        </div>
      </section>
    </div>
  );
}
