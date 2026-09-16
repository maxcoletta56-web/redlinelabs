"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useCart } from "@/lib/cart";

const links = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const { count, setDrawerOpen } = useCart();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40">
      <div className="bg-black py-2 text-center text-[11px] font-medium tracking-[0.08em] text-white uppercase">
        Research use only — not for human or animal consumption
      </div>
      <div className="border-b border-[#ececef] bg-white">
        <div className="wrap flex h-[68px] items-center justify-between gap-4">
          <BrandMark className="text-[22px] sm:text-[26px]" />
          <nav className="hidden items-center gap-6 text-[14px] font-medium text-[#111] lg:flex">
            {links.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={active ? "text-[#e11d2e]" : "hover:text-[#e11d2e]"}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-[#111]"
              aria-label="Search catalogue"
              onClick={() => setSearchOpen((v) => !v)}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center text-[#111]"
              aria-label="Open cart"
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e11d2e] px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </button>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-[#111] lg:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
        {searchOpen && (
          <form action="/shop" className="wrap pb-4">
            <label htmlFor="header-search" className="sr-only">
              Search catalogue
            </label>
            <input
              id="header-search"
              name="q"
              type="search"
              placeholder="Search name, SKU, or category"
              className="field"
              autoFocus
            />
          </form>
        )}
        {open && (
          <div
            id="mobile-nav"
            className="border-t border-[#ececef] bg-white px-5 py-3 lg:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-[15px] text-[#111] hover:text-[#e11d2e]"
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

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="m16 16 5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="20" r="1.15" fill="currentColor" />
      <circle cx="18" cy="20" r="1.15" fill="currentColor" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      {open ? (
        <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" />
      ) : (
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
