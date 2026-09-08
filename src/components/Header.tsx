"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Catalogue" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { count, setDrawerOpen } = useCart();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="border-b border-[rgba(212,175,55,0.18)] bg-[#080808] py-2 text-center text-[10px] font-medium tracking-[0.2em] text-[#d4af37] uppercase">
        Research use only · Australia-wide dispatch
      </div>
      <div className="border-b border-[rgba(212,175,55,0.12)] bg-black/90 backdrop-blur-md">
        <div className="mx-auto flex h-[84px] max-w-[1200px] items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/brand/logo.png"
              alt="Redline Labs Ltd"
              width={168}
              height={44}
              className="h-10 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-8 text-[12px] font-medium tracking-[0.14em] text-[#cfc8b8] uppercase lg:flex">
            {links.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative pb-1 transition-colors hover:text-[#d4af37] ${
                    active ? "text-[#d4af37]" : ""
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/shop" className="btn hidden h-10 px-4 sm:inline-flex">
              Shop
            </Link>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center border border-[rgba(212,175,55,0.28)] text-[#d4af37] transition hover:bg-[rgba(212,175,55,0.08)]"
              aria-label="Open cart"
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-[#d4af37] px-1 text-[10px] font-semibold text-black">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center border border-[rgba(212,175,55,0.28)] text-[#d4af37] lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle menu"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
        {open && (
          <div className="border-t border-[rgba(212,175,55,0.12)] bg-black px-5 py-4 lg:hidden">
            <nav className="flex flex-col text-[12px] font-medium tracking-[0.14em] uppercase">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="py-2.5 text-[#d8d8d8] hover:text-[#d4af37]"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H2"
        stroke="currentColor"
        strokeWidth="1.6"
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
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.7" />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
