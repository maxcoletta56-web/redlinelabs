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
      <div className="bg-[#d4af37] py-2 text-center text-[11px] font-medium tracking-[0.06em] text-black">
        For laboratory research use only. Not for human or veterinary consumption.
      </div>
      <div className="border-b border-[rgba(212,175,55,0.16)] bg-[#050505]/92 backdrop-blur-md">
        <div className="wrap grid h-[72px] grid-cols-[auto_1fr_auto] items-center gap-4">
          <BrandMark priority />
          <nav className="hidden items-center justify-center gap-7 text-[13px] font-medium tracking-[0.04em] text-[#cfc8b8] lg:flex">
            {links.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative py-1 transition-colors ${
                    active ? "text-[#d4af37]" : "hover:text-white"
                  }`}
                >
                  {link.label}
                  {active && (
                    <span className="absolute inset-x-0 -bottom-1 h-px bg-[#d4af37]" />
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-[#f3f1ea] hover:text-[#d4af37]"
              aria-label="Search catalogue"
              aria-expanded={searchOpen}
              aria-controls={searchOpen ? "header-search" : undefined}
              onClick={() => setSearchOpen((v) => !v)}
            >
              <SearchIcon />
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="relative flex h-10 w-10 items-center justify-center text-[#f3f1ea] hover:text-[#d4af37]"
              aria-label="Open cart"
            >
              <CartIcon />
              {count > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#d4af37] px-1 text-[10px] font-semibold text-black">
                  {count}
                </span>
              )}
            </button>
            <Link
              href="/shop"
              className="btn ml-2 h-10 px-5 py-0 text-[11px] max-lg:!hidden lg:!inline-flex"
            >
              Shop
            </Link>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center text-white lg:hidden"
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
          <form
            action="/shop"
            className="wrap pb-4"
            onSubmit={() => {
              setSearchOpen(false);
              setOpen(false);
            }}
          >
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
            className="border-t border-[rgba(212,175,55,0.16)] bg-[#050505] px-5 py-3 lg:hidden"
          >
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="block py-2.5 text-[15px] text-[#cfc8b8] hover:text-[#d4af37]"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/shop"
              onClick={() => setOpen(false)}
              className="btn mt-2 mb-3 w-full"
            >
              Shop catalogue
            </Link>
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
