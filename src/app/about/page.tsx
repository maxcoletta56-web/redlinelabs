import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import {
  IconClock,
  IconPin,
  IconShield,
  IconStar,
  IconTruck,
} from "@/components/Icons";

export const metadata: Metadata = {
  title: {
    absolute: "About Metro Uniforms | Workwear Melbourne",
  },
  description:
    "Metro Uniforms is a Melbourne-based workwear and uniforms business supplying quality uniforms Australia-wide. Corporate uniforms, hi-vis, hospitality, and custom fitting — with local expertise and fast delivery.",
  keywords: [
    "workwear Melbourne",
    "quality uniforms Australia",
    "corporate uniforms",
    "hi-vis workwear",
    "custom workwear Melbourne",
    "hospitality uniforms Australia",
    "bulk uniforms Melbourne",
    "Australian workwear supplier",
  ],
  openGraph: {
    title: "About Metro Uniforms | Workwear Melbourne",
    description:
      "Melbourne-based workwear and corporate uniforms for teams that need gear that lasts. Local expertise, custom fitting, and Australia-wide delivery.",
    images: [{ url: "/about/hero.jpg", width: 1280, height: 720, alt: "Metro Uniforms crew on a Melbourne worksite" }],
    locale: "en_AU",
    type: "website",
  },
  alternates: { canonical: "/about" },
};

const values = [
  {
    title: "Quality",
    text: "Fabrics and construction chosen for Australian heat, wash cycles, and long shifts — not a single photoshoot.",
  },
  {
    title: "Reliability",
    text: "Stocked core sizes, clear lead times, and orders that land when your roster actually needs them.",
  },
  {
    title: "Service",
    text: "A Melbourne team that answers the phone, measures properly, and stays on the job after the first drop.",
  },
  {
    title: "Innovation",
    text: "Better fits, smarter fabric blends, and ordering that works for a five-person crew or a 500-site program.",
  },
];

const sellingPoints = [
  {
    title: "Local Australian expertise",
    text: "Workwear Melbourne businesses actually wear: hi-vis that meets site rules, corporate uniforms that look sharp in a CBD lobby, and ranges built for our climate.",
  },
  {
    title: "Fast Australia-wide delivery",
    text: "Dispatch from Melbourne with tracked freight. Replacements and top-ups without waiting on an overseas container.",
  },
  {
    title: "Built to last on the tools",
    text: "Reinforced seams, colour that holds after industrial laundry, and quality uniforms Australia teams can issue with confidence.",
  },
  {
    title: "Custom fitting and branding",
    text: "Sizing sessions, embroidery, and bulk programs so every vest, polo, and chef jacket carries your name the right way.",
  },
];

const testimonials = [
  {
    quote:
      "We used to lose a week every time a new starter needed hi-vis. Metro had sizes on the shelf and the embroidery back before induction finished.",
    name: "Daniel",
    role: "Civil site supervisor, western Melbourne",
  },
  {
    quote:
      "Corporate uniforms that survive a facilities roster, not just a photoshoot. The fitting session saved us a pile of returns.",
    name: "Priya",
    role: "Facilities manager, inner-city portfolio",
  },
  {
    quote:
      "Bulk order for two kitchens, delivered in one hit. The chef jackets actually fit the team we have, not a generic chart.",
    name: "Marco",
    role: "Hospitality operator, inner north",
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Metro Uniforms",
  description:
    "Melbourne-based workwear and uniforms supplier offering quality uniforms Australia-wide, including corporate uniforms, hi-vis, and custom fitting.",
  areaServed: "AU",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Melbourne",
    addressRegion: "VIC",
    addressCountry: "AU",
  },
};

export default function AboutPage() {
  return (
    <div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="relative isolate overflow-hidden border-b border-[rgba(212,175,55,0.16)]">
        <Image
          src="/about/hero.jpg"
          alt="Melbourne trades crew in hi-vis and navy workwear reviewing plans on a city construction site"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/72 to-black/45" />
        <div className="wrap relative z-10 py-16 sm:py-20 lg:py-28">
          <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "About" }]} />
          <p className="kicker mb-4">Workwear Melbourne · Est. 2016</p>
          <h1 className="mb-5 max-w-3xl text-[2.35rem] leading-[1.12] font-semibold tracking-[-0.03em] text-white sm:text-5xl">
            Workwear that earns its place on site.
          </h1>
          <p className="mb-8 max-w-xl text-[16px] leading-7 text-[#d7d2c6]">
            Quality uniforms Australia businesses issue with confidence — from
            corporate teams to tradies who start before dawn.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/shop" className="btn">
              Shop workwear
            </Link>
            <Link href="/contact" className="btn-outline bg-black/30">
              Bulk order enquiry
            </Link>
          </div>
        </div>
      </section>

      <section aria-label="Trust signals" className="border-b border-[rgba(212,175,55,0.16)] bg-[#0b0b0b]">
        <div className="wrap grid gap-8 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: IconPin, label: "Melbourne based", detail: "Australian owned & operated" },
            { icon: IconClock, label: "Since 2016", detail: "A decade outfitting crews" },
            { icon: IconTruck, label: "Fast dispatch", detail: "Australia-wide delivery" },
            { icon: IconShield, label: "Site-ready kit", detail: "Hi-vis, corporate, hospitality" },
          ].map((item) => (
            <div key={item.label} className="flex gap-3">
              <div className="mt-0.5 text-[#d4af37]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[14px] font-medium text-white">{item.label}</p>
                <p className="text-[13px] leading-5 text-[#8f8c84]">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)] py-16 lg:py-20">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <div className="surface relative aspect-[4/3] overflow-hidden">
            <Image
              src="/about/story.jpg"
              alt="Metro Uniforms warehouse team packing navy polos and hi-vis workwear in Melbourne"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="kicker mb-3">Our story</p>
            <h2 className="section-title mb-5">Why Metro Uniforms exists</h2>
            <div className="space-y-4 text-[15px] leading-8 text-[#cfc8b8]">
              <p>
                Metro Uniforms was founded in Melbourne because too many
                Australian businesses were stuck between cheap imports that fell
                apart after one season and slow, ill-fitting corporate programs.
                Facilities managers chased backorders. Tradies bought retail
                workwear that could not handle heat, long shifts, or a company
                standard. Owners needed a local partner who understood a CBD
                reception desk as well as a civil site in the west.
              </p>
              <p>
                We built Metro to close that gap: quality uniforms Australia-wide,
                with Melbourne expertise behind every order. From hi-vis and
                corporate uniforms to hospitality and healthcare sets, we stock
                durable workwear, offer custom fitting and embroidery, and
                dispatch fast so crews are not waiting in the wrong size.
              </p>
              <p>
                What drives us is simple. When your team looks the part and the
                gear lasts, you spend less time replacing kit and more time
                running the job. We still measure twice, ship once, and stay on
                the account after the first drop. That is the problem we show up
                for.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] py-16 lg:py-20">
        <div className="wrap">
          <p className="kicker mb-3">Our values</p>
          <h2 className="section-title mb-10 max-w-xl">How we run the business</h2>
          <div className="grid gap-px bg-[rgba(212,175,55,0.16)] sm:grid-cols-2">
            {values.map((value, index) => (
              <article key={value.title} className="bg-[#0b0b0b] p-7">
                <p className="mb-3 text-[11px] tracking-[0.16em] text-[#d4af37]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mb-2 text-[18px] font-medium text-white">{value.title}</h3>
                <p className="text-[14px] leading-7 text-[#8f8c84]">{value.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)] py-16 lg:py-20">
        <div className="wrap grid items-start gap-12 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="kicker mb-3">Why choose us</p>
            <h2 className="section-title mb-5">Kit that works as hard as the roster</h2>
            <p className="mb-8 text-[15px] leading-7 text-[#8f8c84]">
              Built for business owners, facilities managers, and tradies who
              cannot wait on a catalogue promise.
            </p>
            <div className="surface relative aspect-[4/3] overflow-hidden">
              <Image
                src="/about/hospitality.jpg"
                alt="Hospitality and facilities staff in corporate polos and chef whites at a Melbourne venue"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
            </div>
          </div>
          <ol className="grid gap-6 sm:grid-cols-2">
            {sellingPoints.map((point, index) => (
              <li key={point.title} className="surface p-6">
                <p className="mb-3 text-[11px] tracking-[0.16em] text-[#d4af37]">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h3 className="mb-2 text-[16px] font-medium text-white">{point.title}</h3>
                <p className="text-[14px] leading-7 text-[#8f8c84]">{point.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)] bg-[#0b0b0b] py-16 lg:py-20">
        <div className="wrap">
          <p className="kicker mb-3">From the job</p>
          <h2 className="section-title mb-10">What crews tell us</h2>
          <div className="grid gap-6 lg:grid-cols-3">
            {testimonials.map((item) => (
              <figure key={item.name} className="surface flex h-full flex-col p-6">
                <div className="mb-4 flex gap-1 text-[#d4af37]" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <IconStar key={i} className="h-3.5 w-3.5" />
                  ))}
                </div>
                <blockquote className="flex-1 text-[15px] leading-7 text-[#cfc8b8]">
                  “{item.quote}”
                </blockquote>
                <figcaption className="mt-5 border-t border-white/8 pt-4">
                  <p className="text-[14px] font-medium text-white">{item.name}</p>
                  <p className="text-[12px] leading-5 text-[#8f8c84]">{item.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[rgba(212,175,55,0.16)] py-16 lg:py-20">
        <div className="wrap grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="kicker mb-3">Melbourne team</p>
            <h2 className="section-title mb-5">People you can actually reach</h2>
            <p className="mb-4 text-[15px] leading-8 text-[#cfc8b8]">
              Metro is run from Melbourne by a small crew of account managers,
              fitters, and dispatch staff. Same people who quote the bulk order
              also chase the carton if a size run is short. No offshore ticket
              queue — just a local team that knows workwear because they kit
              sites, kitchens, and offices across Victoria every week.
            </p>
            <p className="text-[15px] leading-8 text-[#cfc8b8]">
              Need a sizing day on site, a logo pack, or a standing order for
              new starters? Talk to us. We work with business owners, facilities
              managers, and tradies who would rather get back to the job than
              argue with a size chart.
            </p>
          </div>
          <div className="surface relative aspect-[16/9] overflow-hidden lg:aspect-[16/10]">
            <Image
              src="/about/team.jpg"
              alt="The Melbourne Metro Uniforms team in the warehouse showroom"
              fill
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover object-top"
            />
          </div>
        </div>
      </section>

      <section className="py-16 lg:py-20">
        <div className="wrap surface px-6 py-12 text-center sm:px-12">
          <p className="kicker mb-3">Ready to kit the team</p>
          <h2 className="section-title mx-auto mb-4 max-w-2xl">
            Shop the range, or talk to us about a bulk program.
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-[15px] leading-7 text-[#8f8c84]">
            Workwear Melbourne businesses trust for day-to-day issue, plus
            corporate uniforms and custom branding for larger crews across
            Australia.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/shop" className="btn">
              Shop workwear
            </Link>
            <Link href="/contact" className="btn-outline">
              Contact for bulk orders
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
