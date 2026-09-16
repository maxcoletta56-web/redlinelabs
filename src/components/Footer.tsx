import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { IconLock, IconMail, IconPin, IconTruck } from "@/components/Icons";

export function Footer() {
  return (
    <footer className="mt-auto bg-black text-white">
      <div className="wrap grid gap-10 py-16 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-1">
          <BrandMark tone="dark" className="mb-4 block text-[26px]" />
          <p className="max-w-xs text-[13px] leading-6 text-[#a1a1aa]">
            Laboratory research chemicals. Australia-wide dispatch. Documentation
            on request.
          </p>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
            Navigation
          </h3>
          <ul className="space-y-2.5 text-sm text-[#a1a1aa]">
            <li><Link href="/" className="hover:text-white">Home</Link></li>
            <li><Link href="/shop" className="hover:text-white">Shop</Link></li>
            <li><Link href="/about" className="hover:text-white">About</Link></li>
            <li><Link href="/faq" className="hover:text-white">FAQ</Link></li>
            <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
            Policies
          </h3>
          <ul className="space-y-2.5 text-sm text-[#a1a1aa]">
            <li><Link href="/shipping-policy" className="hover:text-white">Shipping Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-white">Refund Policy</Link></li>
            <li><Link href="/privacy-policy" className="hover:text-white">Privacy Policy</Link></li>
            <li><Link href="/terms-of-service" className="hover:text-white">Terms & Conditions</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
            Contact
          </h3>
          <a href="mailto:redlinelabsltd@pm.me" className="text-sm text-[#a1a1aa] hover:text-white">
            redlinelabsltd@pm.me
          </a>
          <p className="mt-2 text-sm text-[#a1a1aa]">Australia-wide dispatch</p>
        </div>
        <div>
          <h3 className="mb-4 text-[11px] font-semibold tracking-[0.14em] text-white uppercase">
            Research use
          </h3>
          <p className="text-sm leading-6 text-[#a1a1aa]">
            Not for human or veterinary consumption. Not a pharmacy.
          </p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="wrap grid gap-6 py-8 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: IconLock, title: "Research use only", text: "Listed for laboratory research, not as medicines." },
            { icon: IconTruck, title: "Australia-wide dispatch", text: "Typical processing within 1–3 business days after payment." },
            { icon: IconMail, title: "COA on request", text: "Email the product name and SKU. Not published on product pages." },
            { icon: IconPin, title: "Support by email", text: "redlinelabsltd@pm.me" },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <div className="text-[#e11d2e]">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[13px] font-medium text-white">{item.title}</p>
                <p className="text-[12px] leading-5 text-[#a1a1aa]">{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 px-5 py-5 text-center text-[12px] leading-6 text-[#a1a1aa]">
        © {new Date().getFullYear()} Redline Labs. For laboratory research use
        only. Not for human or veterinary consumption. Not evaluated or approved
        for the diagnosis, treatment, cure, or prevention of any disease.
      </div>
    </footer>
  );
}
