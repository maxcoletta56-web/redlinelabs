"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact Us" },
  { href: "/faq", label: "FAQ" },
];

export function Header() {
  const { count, setDrawerOpen } = useCart();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(212,175,55,0.18)] bg-black/90 backdrop-blur-md">
      <div className="mx-auto flex h-[78px] max-w-[1400px] items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/brand/icon.jpeg"
            alt="Redline Labs"
            width={46}
            height={46}
            className="rounded-full"
            priority
          />
          <Image
            src="/brand/logo.png"
            alt="Redline Labs Ltd"
            width={168}
            height={42}
            className="hidden h-10 w-auto sm:block"
            priority
          />
        </Link>

        <nav className="hidden items-center gap-8 text-[13px] font-semibold tracking-[0.14em] uppercase text-[#d8d8d8] lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[#d4af37]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/shop"
            className="hidden rounded-sm bg-[#d4af37] px-4 py-2 text-xs font-bold tracking-[0.14em] text-black uppercase transition hover:bg-[#f6e7b2] sm:inline-flex"
          >
            Shop Now
          </Link>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.28)] text-[#d4af37] transition hover:bg-[rgba(212,175,55,0.08)]"
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
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(212,175,55,0.28)] text-[#d4af37] lg:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <MenuIcon open={open} />
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-[rgba(212,175,55,0.18)] bg-black px-5 py-4 lg:hidden">
          <nav className="flex flex-col gap-3 text-sm font-semibold uppercase tracking-[0.16em]">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="py-2 text-[#d8d8d8] hover:text-[#d4af37]"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H2"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.3" fill="currentColor" />
      <circle cx="18" cy="20" r="1.3" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <path
          d="M4 7h16M4 12h16M4 17h16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}
