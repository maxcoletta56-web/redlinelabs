import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-[rgba(212,175,55,0.16)] bg-[#080808]">
      <div className="wrap grid gap-12 py-16 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Image
            src="/brand/logo.png"
            alt="Redline Labs"
            width={160}
            height={40}
            className="mb-5 h-8 w-auto"
          />
          <p className="max-w-xs text-[13px] leading-6 text-[#8f8c84]">
            Laboratory research chemicals. Australia-wide dispatch. Documentation
            on request.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
            Contact
          </h3>
          <a href="mailto:redlinelabsltd@pm.me" className="text-sm text-[#cfc8b8] hover:text-[#d4af37]">
            redlinelabsltd@pm.me
          </a>
          <p className="mt-2 text-sm text-[#8f8c84]">Australia-wide dispatch</p>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
            Policies
          </h3>
          <ul className="space-y-2.5 text-sm text-[#cfc8b8]">
            <li><Link href="/privacy-policy" className="hover:text-[#d4af37]">Privacy Policy</Link></li>
            <li><Link href="/terms-of-service" className="hover:text-[#d4af37]">Terms &amp; Conditions</Link></li>
            <li><Link href="/shipping-policy" className="hover:text-[#d4af37]">Shipping Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-[#d4af37]">Refund Policy</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
            Site
          </h3>
          <ul className="space-y-2.5 text-sm text-[#cfc8b8]">
            <li><Link href="/" className="hover:text-[#d4af37]">Home</Link></li>
            <li><Link href="/shop" className="hover:text-[#d4af37]">Catalogue</Link></li>
            <li><Link href="/about" className="hover:text-[#d4af37]">About</Link></li>
            <li><Link href="/faq" className="hover:text-[#d4af37]">FAQ</Link></li>
            <li><Link href="/contact" className="hover:text-[#d4af37]">Contact</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/8 px-5 py-5 text-center text-[12px] leading-6 text-[#8f8c84]">
        © {new Date().getFullYear()} Redline Labs. For laboratory research use
        only. Not for human or veterinary consumption. Not evaluated or approved
        for the diagnosis, treatment, cure, or prevention of any disease.
      </div>
    </footer>
  );
}
