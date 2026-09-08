import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { featuredProducts } from "@/lib/products";

const trustItems = [
  { icon: "🚚", title: "Fast Nationwide Shipping", text: "Quick & reliable delivery" },
  { icon: "🧪", title: "Lab-Tested Purity", text: "Verified research quality" },
  { icon: "🏆", title: "Premium Grade", text: "Trusted research products" },
  { icon: "🔒", title: "Secure Payment", text: "Protected checkout" },
];

const stats = [
  { value: "99%", label: "Purity Standard" },
  { value: "24H", label: "Fast Dispatch" },
  { value: "1000+", label: "Orders Delivered" },
  { value: "5★", label: "Customer Satisfaction" },
];

const reasons = [
  {
    icon: "⚗",
    title: "Research Grade Quality",
    text: "Produced using strict manufacturing standards to deliver exceptional consistency and quality.",
  },
  {
    icon: "⬢",
    title: "Verified Purity",
    text: "Every batch undergoes comprehensive quality procedures for confidence and reliability.",
  },
  {
    icon: "✦",
    title: "Fast Dispatch",
    text: "Orders are carefully packed and processed promptly for a smooth experience.",
  },
];

const audience = [
  {
    n: "A • 01",
    icon: "⚗",
    title: "Research Laboratories",
    text: "Professional laboratory environments conducting analytical and scientific studies requiring dependable materials.",
  },
  {
    n: "B • 02",
    icon: "⬢",
    title: "Biotech Teams",
    text: "Biotechnology professionals and specialists requiring premium research-grade materials and support.",
  },
  {
    n: "C • 03",
    icon: "✦",
    title: "Analytical Scientists",
    text: "Scientific investigators performing controlled analytical studies and advanced testing procedures.",
  },
  {
    n: "D • 04",
    icon: "◉",
    title: "Research Institutions",
    text: "Universities and qualified organizations conducting educational and research-focused programs.",
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
      <section className="hero-grid relative overflow-hidden border-b border-[rgba(212,175,55,0.15)] px-5 py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1400px] items-center gap-10 lg:grid-cols-2">
          <div>
            <div className="mb-5 inline-flex rounded-full border border-[#d4af37] px-4 py-1.5 text-[11px] font-semibold tracking-[0.16em] text-[#d4af37] uppercase">
              Research use only • Sterile filtered
            </div>
            <p className="mb-2 text-sm font-semibold tracking-[0.32em] text-white uppercase">
              Premium Sterile
            </p>
            <h1 className="gold-text mb-5 text-5xl font-extrabold tracking-tight uppercase sm:text-6xl lg:text-7xl">
              Redline Labs
            </h1>
            <p className="mb-8 max-w-xl text-base leading-8 text-[#d8d8d8]">
              High-quality sterile filtered materials manufactured for research
              applications. Laboratory-grade quality, secure packaging, and
              dependable consistency for professional research environments.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/shop"
                className="rounded-sm bg-[#d4af37] px-7 py-3.5 text-xs font-bold tracking-[0.18em] text-black uppercase transition hover:bg-[#f6e7b2]"
              >
                Shop Now →
              </Link>
              <Link
                href="/about"
                className="rounded-sm border border-[#d4af37] px-7 py-3.5 text-xs font-bold tracking-[0.18em] text-[#d4af37] uppercase transition hover:bg-[rgba(212,175,55,0.08)]"
              >
                View Specifications →
              </Link>
            </div>
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                "Sterile Filtered",
                "Laboratory Grade",
                "Secure Packaging",
                "Research Use Only",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-xl border border-[rgba(212,175,55,0.15)] px-3 py-3 text-center text-[11px] tracking-wide text-[#d4af37]"
                >
                  {label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative mx-auto max-w-md">
            <div className="absolute inset-8 rounded-full bg-[#d4af37]/10 blur-3xl" />
            <Image
              src="/brand/vial.png"
              alt="Redline Labs sterile filtered vial"
              width={550}
              height={977}
              className="relative z-10 mx-auto h-auto w-full max-w-[380px] object-contain"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-y border-[rgba(212,175,55,0.2)] bg-black px-5 py-10">
        <div className="mx-auto grid max-w-[1400px] gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div
              key={item.title}
              className="flex items-center gap-4 rounded-xl border border-[rgba(212,175,55,0.15)] bg-[linear-gradient(145deg,rgba(212,175,55,.08),rgba(212,175,55,.02))] p-4 transition hover:-translate-y-1 hover:border-[#d4af37]"
            >
              <div className="flex h-[60px] w-[60px] min-w-[60px] items-center justify-center rounded-full border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.08)] text-2xl">
                {item.icon}
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-[#d4af37]">{item.title}</h2>
                <p className="text-sm text-[#cfcfcf]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-10 text-center">
            <p className="mb-2 text-xs tracking-[0.28em] text-[#d4af37] uppercase">
              Featured catalogue
            </p>
            <h2 className="text-3xl font-bold">Research Peptides Australia</h2>
          </div>
          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/shop"
              className="inline-flex rounded-sm border border-[#d4af37] px-7 py-3 text-xs font-bold tracking-[0.18em] text-[#d4af37] uppercase"
            >
              View full shop
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#050505] px-5 py-24">
        <div className="mx-auto grid max-w-[1400px] items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs font-bold tracking-[0.28em] text-[#d4af37] uppercase">
              Research excellence
            </p>
            <h2 className="mb-5 text-4xl font-bold leading-tight">
              Setting The Standard In Research Quality
            </h2>
            <p className="max-w-xl text-base leading-8 text-[#c8c8c8]">
              Our commitment to precision, consistency, and quality drives every
              aspect of our operation. We focus on delivering premium research
              products backed by strict quality standards and exceptional
              service.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-5">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[20px] border border-[rgba(212,175,55,0.15)] bg-[linear-gradient(180deg,rgba(255,255,255,.03),rgba(255,255,255,.01))] p-8 text-center backdrop-blur-xl transition hover:-translate-y-2 hover:border-[#d4af37]"
              >
                <h3 className="text-4xl font-extrabold text-[#d4af37]">{stat.value}</h3>
                <span className="mt-2 block text-white">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1100px] text-center">
          <h2 className="mb-12 text-3xl font-bold">Why Redline Labs?</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {reasons.map((reason) => (
              <div key={reason.title} className="px-4">
                <div className="mb-4 text-3xl">{reason.icon}</div>
                <h3 className="mb-3 text-xl font-semibold">{reason.title}</h3>
                <p className="text-sm leading-7 text-[#bdbdbd]">{reason.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="mx-auto max-w-[1400px]">
          <p className="mb-2 text-xs font-bold tracking-[0.28em] text-[#d4af37] uppercase">
            Who we serve
          </p>
          <h2 className="mb-10 text-3xl font-bold">Built For Serious Research</h2>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {audience.map((card, i) => (
              <article
                key={card.title}
                className={`border-l-2 border-[#d4af37] px-5 py-6 transition hover:-translate-y-1 ${
                  i % 2 === 0
                    ? "rounded-2xl bg-[linear-gradient(180deg,rgba(212,175,55,.06),rgba(212,175,55,.01))]"
                    : ""
                }`}
              >
                <div className="mb-4 flex h-[55px] w-[55px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#D4AF37,#F8E08A)] text-xl font-bold text-black">
                  {card.icon}
                </div>
                <p className="mb-3 text-xs font-bold tracking-[0.18em] text-[#d4af37]">
                  {card.n}
                </p>
                <h3 className="mb-3 text-[22px] font-bold leading-tight">{card.title}</h3>
                <p className="mb-5 text-sm leading-7 text-[#bdbdbd]">{card.text}</p>
                <span className="inline-flex rounded-full border border-[rgba(212,175,55,0.15)] bg-[rgba(212,175,55,0.08)] px-4 py-2 text-[11px] font-bold tracking-[0.12em] text-[#d4af37]">
                  ✓ VERIFIED
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden bg-[#050505] py-24">
        <div className="mb-10 px-5 text-center">
          <p className="mb-2 text-xs font-bold tracking-[0.28em] text-[#d4af37] uppercase">
            Trusted by researchers
          </p>
          <h2 className="text-3xl font-bold">Customer Experiences</h2>
        </div>
        <div className="flex w-max gap-6 px-5 marquee-track">
          {looped.map((review, i) => (
            <article
              key={`${review.name}-${i}`}
              className="card-sheen w-[350px] min-w-[350px] rounded-[22px] border border-[rgba(212,175,55,0.18)] bg-[linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01))] p-9 backdrop-blur-xl"
            >
              <div className="mb-5 text-[22px] text-[#d4af37]">★★★★★</div>
              <p className="mb-6 text-[15px] leading-8 text-[#d4d4d4]">{review.quote}</p>
              <h4 className="text-[17px] font-semibold">{review.name}</h4>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-[rgba(212,175,55,0.15)] px-5 py-20">
        <div className="mx-auto max-w-xl text-center">
          <p className="gold-text mb-2 text-5xl font-extrabold">15% OFF</p>
          <p className="mb-2 text-sm tracking-[0.2em] text-[#d4af37] uppercase">
            Especially for you
          </p>
          <h2 className="mb-4 text-2xl font-bold">15% off Retatrutide</h2>
          <p className="mb-6 text-sm leading-7 text-[#cfcfcf]">
            Join the list today for new product releases, availability updates,
            and subscriber-only offers.
          </p>
          <form className="flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              required
              placeholder="Email address"
              className="flex-1 rounded-sm border border-[rgba(212,175,55,0.3)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <button className="rounded-sm bg-[#d4af37] px-6 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase">
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
