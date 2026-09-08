import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import {
  IconBeaker,
  IconCard,
  IconFlag,
  IconShield,
  IconStar,
  IconTruck,
  IconUser,
} from "@/components/Icons";
import { featuredProducts, premiumProducts } from "@/lib/products";

const trustItems = [
  { icon: IconTruck, title: "Fast Australia-wide shipping" },
  { icon: IconBeaker, title: "Lab-tested, verified purity" },
  { icon: IconFlag, title: "Australian-owned" },
  { icon: IconCard, title: "Secure payment" },
];

const whyItems = [
  {
    icon: IconShield,
    title: "Lab tested quality",
    text: "Materials are handled to consistent research-grade standards so you can order with confidence.",
  },
  {
    icon: IconTruck,
    title: "Fast & secure shipping",
    text: "Orders are packed carefully and dispatched promptly, Australia-wide.",
  },
  {
    icon: IconUser,
    title: "Dedicated customer support",
    text: "Our team is available to help with catalogue questions and order support.",
  },
];

const promises = [
  {
    kicker: "Quality",
    title: "99% purity standard",
    text: "Research materials are supplied to a high-purity standard for laboratory use only.",
  },
  {
    kicker: "Dispatch",
    title: "Processed in 1–3 days",
    text: "Most orders are processed promptly after payment, then packed for transit.",
  },
  {
    kicker: "Support",
    title: "Help when you need it",
    text: "Reach the team by email during business hours for order and catalogue questions.",
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
  const premium = premiumProducts();

  return (
    <div>
      <section className="border-b border-white/10">
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-20">
          <div>
            <p className="mb-4 text-[12px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
              Research use only · Sterile filtered
            </p>
            <h1 className="mb-5 text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[52px]">
              Lab-tested research peptides. Every batch. Shipped Australia-wide.
            </h1>
            <p className="mb-8 max-w-xl text-[16px] leading-7 text-[#b0b0b0]">
              Ultra-pure, lab-verified research peptides with consistent handling,
              secure packaging, and nationwide dispatch.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/shop" className="btn">
                Shop now
              </Link>
              <Link href="/about" className="btn-outline">
                View quality standards
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]">
            <div className="absolute inset-8 rounded-full bg-[#d4af37]/15 blur-3xl" />
            <Image
              src="/brand/vial.png"
              alt="Redline Labs research vial"
              width={550}
              height={977}
              className="relative z-10 mx-auto h-auto w-full max-h-[520px] object-contain"
              priority
            />
            <div className="absolute bottom-6 left-0 z-20 hidden rounded-full bg-black/80 px-3 py-2 text-[11px] font-semibold text-[#d4af37] ring-1 ring-[#d4af37]/40 sm:block">
              99%+ purity
            </div>
            <div className="absolute right-0 top-10 z-20 hidden rounded-full bg-black/80 px-3 py-2 text-[11px] font-semibold text-[#d4af37] ring-1 ring-[#d4af37]/40 sm:block">
              Research grade
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-5 py-10">
        <div className="mx-auto grid max-w-[1180px] gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {trustItems.map((item) => (
            <div key={item.title} className="flex items-start gap-3">
              <div className="text-[#d4af37]">
                <item.icon className="h-10 w-10" />
              </div>
              <h2 className="pt-1 text-[15px] font-semibold leading-snug">{item.title}</h2>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Best-selling products</h2>
            <p className="mt-2 text-[#9a9a9a]">Most purchased</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop" className="btn-outline">
              View more
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-[#0d0d0d] px-5 py-20">
        <div className="mx-auto max-w-[1080px]">
          <h2 className="mb-12 text-center text-3xl font-bold sm:text-4xl">Why shop with us?</h2>
          <div className="grid gap-10 md:grid-cols-3">
            {whyItems.map((item) => (
              <div key={item.title} className="text-center">
                <div className="mb-4 flex justify-center text-[#d4af37]">
                  <item.icon className="h-12 w-12" />
                </div>
                <h3 className="mb-3 text-xl font-bold">{item.title}</h3>
                <p className="text-sm leading-7 text-[#9a9a9a]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-[1180px]">
          <p className="kicker mb-2 text-center">Quality</p>
          <h2 className="mb-3 text-center text-3xl font-bold sm:text-4xl">
            How Redline Labs works
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-center text-[#9a9a9a]">
            Straightforward supply for research teams: consistent handling, prompt
            dispatch, and support that answers.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            {promises.map((item) => (
              <article key={item.title}>
                <p className="mb-2 text-[12px] font-semibold text-[#d4af37] uppercase">
                  {item.kicker}
                </p>
                <h3 className="mb-2 text-xl font-bold">{item.title}</h3>
                <p className="text-sm leading-7 text-[#9a9a9a]">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Premium peptides</h2>
            <p className="mt-2 text-[#9a9a9a]">Trusted by researchers, backed by quality standards</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {premium.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop" className="btn-outline">
              View all
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-[980px]">
          <h2 className="mb-10 text-center text-3xl font-bold sm:text-4xl">
            What our customers are saying
          </h2>
          <div className="grid gap-5 md:grid-cols-2">
            {reviews.map((review) => (
              <article key={review.name} className="rounded-lg bg-[#161616] p-7">
                <div className="mb-4 flex gap-1 text-[#d4af37]">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} className="h-4 w-4" />
                  ))}
                </div>
                <p className="mb-4 text-sm leading-7 text-[#d0d0d0]">{review.quote}</p>
                <p className="font-semibold text-[#d4af37]">{review.name}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-14">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="mb-5 text-[16px] text-[#d4af37]">
            Get 15% off Retatrutide. Join our list for new products, research
            updates, and special offers.
          </p>
          <form className="mx-auto flex max-w-md overflow-hidden rounded-lg border border-white/15">
            <input
              type="email"
              required
              placeholder="Email"
              className="min-w-0 flex-1 bg-transparent px-4 py-3 text-sm outline-none"
            />
            <button className="bg-[#d4af37] px-5 text-sm font-semibold text-black">
              Submit
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}
