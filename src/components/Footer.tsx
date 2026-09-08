import Image from "next/image";
import Link from "next/link";

const shopLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

const legalLinks = [
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/refund-policy", label: "Refunds" },
  { href: "/privacy-policy", label: "Privacy" },
  { href: "/terms-of-service", label: "Terms" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[rgba(212,175,55,0.14)] bg-[#080808]">
      <div className="mx-auto grid max-w-[1280px] gap-12 px-5 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image
            src="/brand/logo.png"
            alt="Redline Labs"
            width={180}
            height={46}
            className="mb-5 h-11 w-auto"
          />
          <p className="max-w-sm text-sm leading-7 text-[#b3b3b3]">
            Laboratory-grade research materials supplied with consistent
            handling, secure packaging, and professional Australian fulfillment.
          </p>
        </div>
        <div className="md:col-span-2">
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-[#d4af37] uppercase">
            Explore
          </h3>
          <ul className="space-y-3 text-sm text-[#d0d0d0]">
            {shopLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-[#d4af37]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-2">
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-[#d4af37] uppercase">
            Policies
          </h3>
          <ul className="space-y-3 text-sm text-[#d0d0d0]">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-[#d4af37]">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.22em] text-[#d4af37] uppercase">
            Contact
          </h3>
          <p className="text-sm leading-7 text-[#d0d0d0]">
            redlinelabsltd@pm.me
            <br />
            Australia-wide dispatch
            <br />
            Monday – Sunday, 6AM – 6PM
          </p>
        </div>
      </div>
      <div className="border-t border-[rgba(212,175,55,0.1)] px-5 py-5 text-center text-[11px] tracking-[0.08em] text-[#8a8a8a]">
        For laboratory research only. Not for human or veterinary use. ©{" "}
        {new Date().getFullYear()} Redline Labs Ltd.
      </div>
    </footer>
  );
}
