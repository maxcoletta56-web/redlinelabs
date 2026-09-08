import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { IconBeaker, IconTruck, IconUser } from "@/components/Icons";
import { featuredProducts, premiumProducts } from "@/lib/products";

const facts = [
  {
    icon: IconBeaker,
    title: "Research supply only",
    text: "Every listing is a laboratory research chemical, not a medicine or supplement.",
  },
  {
    icon: IconTruck,
    title: "Australia-wide dispatch",
    text: "The shipping policy currently states typical processing within 1–3 business days after payment.",
  },
  {
    icon: IconUser,
    title: "Support by email",
    text: "Questions about SKUs, orders, or documentation: redlinelabsltd@pm.me",
  },
];

export default function Home() {
  const featured = featuredProducts();
  const premium = premiumProducts();

  return (
    <div>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-[1180px] px-5 pt-6">
          <ResearchDisclaimer />
        </div>
        <div className="mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-14 lg:grid-cols-2 lg:py-16">
          <div>
            <p className="mb-4 text-[12px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">
              Laboratory research chemicals
            </p>
            <h1 className="mb-5 text-4xl font-extrabold leading-[1.15] tracking-tight text-white sm:text-5xl lg:text-[48px]">
              Research peptides for laboratory use. Shipped within Australia.
            </h1>
            <p className="mb-8 max-w-xl text-[16px] leading-7 text-[#b0b0b0]">
              Redline Labs lists compounds for qualified laboratory research.
              Certificates of Analysis are available on request. No product on
              this site is offered for human or veterinary use.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link href="/shop" className="btn">
                Shop
              </Link>
              <Link href="/about" className="btn-outline">
                About
              </Link>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[420px]">
            <Image
              src="/brand/vial.png"
              alt="Redline Labs research vial"
              width={550}
              height={977}
              className="relative z-10 mx-auto h-auto w-full max-h-[480px] object-contain"
              priority
            />
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 px-5 py-12">
        <div className="mx-auto grid max-w-[1180px] gap-8 md:grid-cols-3">
          {facts.map((item) => (
            <div key={item.title} className="flex gap-4">
              <div className="text-[#d4af37]">
                <item.icon className="h-8 w-8" />
              </div>
              <div>
                <h2 className="mb-1 text-[15px] font-semibold">{item.title}</h2>
                <p className="text-sm leading-6 text-[#9a9a9a]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 py-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">Selected products</h2>
            <p className="mt-2 text-[#9a9a9a]">A short list from the current catalogue</p>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link href="/shop" className="btn-outline">
              View all products
            </Link>
          </div>
        </div>
      </section>

      <section className="px-5 pb-16">
        <div className="mx-auto max-w-[1180px]">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold sm:text-4xl">More from the catalogue</h2>
          </div>
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {premium.map((product) => (
              <ProductCard key={product.slug} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 px-5 py-14">
        <div className="mx-auto max-w-[640px] text-center">
          <p className="mb-5 text-[16px] text-[#cfcfcf]">
            Catalogue updates and availability notices. Research-use listings
            only.
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
