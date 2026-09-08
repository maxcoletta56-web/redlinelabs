"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact Us" },
];

export function Header() {
  const { count, setDrawerOpen } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-[#d4af37] py-2.5 text-center text-[13px] font-medium text-black">
        Orders dispatched within 1–3 business days · Fast Australia-wide shipping
      </div>
      <div className="border-b border-white/10 bg-[#050505]/95 backdrop-blur">
        <div className="mx-auto flex h-[76px] max-w-[1180px] items-center justify-between gap-4 px-5">
          <Link href="/" className="shrink-0">
            <Image
              src="/brand/logo.png"
              alt="Redline Labs"
              width={170}
              height={44}
              className="h-9 w-auto"
              priority
            />
          </Link>
          <nav className="hidden items-center gap-7 text-[15px] font-medium text-[#e8e8e8] lg:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? "text-[#d4af37]" : "hover:text-[#d4af37]"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/shop" className="btn hidden h-10 px-4 text-[13px] sm:inline-flex">
              Shop now
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center text-white hover:text-[#d4af37]"
              aria-label="Open cart"
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#d4af37] px-1 text-[11px] font-bold text-black">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-white lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-white/10 bg-[#050505] px-5 py-3 lg:hidden">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-[15px] hover:text-[#d4af37]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.2" fill="currentColor" />
      <circle cx="18" cy="20" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
