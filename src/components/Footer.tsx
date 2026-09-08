import Image from "next/image";
import Link from "next/link";

const shopLinks = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
];

const legalLinks = [
  { href: "/shipping-policy", label: "Shipping Policy" },
  { href: "/refund-policy", label: "Refund Policy" },
  { href: "/privacy-policy", label: "Privacy Policy" },
  { href: "/terms-of-service", label: "Terms Of Service" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[rgba(212,175,55,0.18)] bg-black">
      <div className="mx-auto grid max-w-[1400px] gap-10 px-5 py-14 md:grid-cols-4">
        <div className="md:col-span-1">
          <Image
            src="/brand/logo.png"
            alt="Redline Labs"
            width={190}
            height={48}
            className="mb-4 h-12 w-auto"
          />
          <p className="max-w-xs text-sm leading-7 text-[#b8b8b8]">
            Premium research-grade materials supplied for laboratory and
            analytical use. Precision, consistency, and professional
            fulfillment.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-bold tracking-[0.22em] text-[#d4af37] uppercase">
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
        <div>
          <h3 className="mb-4 text-xs font-bold tracking-[0.22em] text-[#d4af37] uppercase">
            Support
          </h3>
          <ul className="space-y-3 text-sm text-[#d0d0d0]">
            {legalLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="hover:text-[#d4af37]">
                  {link.label}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/contact" className="hover:text-[#d4af37]">
                Support
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-bold tracking-[0.22em] text-[#d4af37] uppercase">
            Contact
          </h3>
          <p className="text-sm leading-7 text-[#d0d0d0]">
            redlinelabsltd@pm.me
            <br />
            Australia-wide dispatch
            <br />
            Monday – Sunday | 6AM – 6PM
          </p>
        </div>
      </div>
      <div className="border-t border-[rgba(212,175,55,0.12)] px-5 py-5 text-center text-xs tracking-wide text-[#8d8d8d]">
        Research use only. Not for human or veterinary use. © {new Date().getFullYear()} Redline Labs Ltd.
      </div>
    </footer>
  );
}
