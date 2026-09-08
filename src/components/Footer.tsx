import Image from "next/image";
import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto bg-[#111]">
      <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Image
            src="/brand/logo.png"
            alt="Redline Labs"
            width={160}
            height={40}
            className="mb-4 h-9 w-auto"
          />
          <p className="text-sm text-[#9a9a9a]">
            © {new Date().getFullYear()} Redline Labs
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-[15px] font-semibold">Contact Us</h3>
          <a href="mailto:redlinelabsltd@pm.me" className="text-sm text-[#cfcfcf] hover:text-[#d4af37]">
            redlinelabsltd@pm.me
          </a>
          <p className="mt-2 text-sm text-[#9a9a9a]">Australia-wide dispatch</p>
        </div>
        <div>
          <h3 className="mb-4 text-[15px] font-semibold">Policy Pages</h3>
          <ul className="space-y-2 text-sm text-[#cfcfcf]">
            <li><Link href="/privacy-policy" className="hover:text-[#d4af37]">Privacy Policy</Link></li>
            <li><Link href="/terms-of-service" className="hover:text-[#d4af37]">Terms &amp; Conditions</Link></li>
            <li><Link href="/shipping-policy" className="hover:text-[#d4af37]">Shipping &amp; Return Policy</Link></li>
            <li><Link href="/faq" className="hover:text-[#d4af37]">Frequently Asked Questions</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[15px] font-semibold">Quick Links</h3>
          <ul className="space-y-2 text-sm text-[#cfcfcf]">
            <li><Link href="/" className="hover:text-[#d4af37]">Home</Link></li>
            <li><Link href="/shop" className="hover:text-[#d4af37]">Shop</Link></li>
            <li><Link href="/about" className="hover:text-[#d4af37]">About Us</Link></li>
            <li><Link href="/contact" className="hover:text-[#d4af37]">Contact Us</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-6 text-center text-[11px] leading-6 text-[#7a7a7a]">
        All products are intended for laboratory research use only. Not for human
        or veterinary use, diagnostic, or therapeutic applications.
      </div>
    </footer>
  );
}
