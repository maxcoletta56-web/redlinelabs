import Image from "next/image";
import Link from "next/link";

const shopLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Catalogue" },
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
    <footer className="mt-auto border-t border-[rgba(212,175,55,0.12)] bg-[#080808]">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 py-16 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image
            src="/brand/logo.png"
            alt="Redline Labs"
            width={170}
            height={44}
            className="mb-5 h-10 w-auto"
          />
          <p className="max-w-sm text-sm leading-7 text-[#a7a193]">
            Laboratory-grade research materials, supplied with consistent
            handling and professional Australian fulfillment.
          </p>
        </div>
        <div className="md:col-span-2">
          <h3 className="kicker mb-4">Explore</h3>
          <ul className="space-y-3 text-sm text-[#d5d0c4]">
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
          <h3 className="kicker mb-4">Policies</h3>
          <ul className="space-y-3 text-sm text-[#d5d0c4]">
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
          <h3 className="kicker mb-4">Contact</h3>
          <p className="text-sm leading-7 text-[#d5d0c4]">
            redlinelabsltd@pm.me
            <br />
            Australia-wide dispatch
            <br />
            Monday–Sunday, 6AM–6PM
          </p>
        </div>
      </div>
      <div className="border-t border-[rgba(212,175,55,0.1)] px-5 py-5 text-center text-[11px] tracking-[0.06em] text-[#7d786c]">
        For laboratory research only. Not for human or veterinary use. ©{" "}
        {new Date().getFullYear()} Redline Labs Ltd.
      </div>
    </footer>
  );
}
