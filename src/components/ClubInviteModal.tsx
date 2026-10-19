"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { MEMBERSHIP_PRICE_CENTS, MEMBER_DISCOUNT_PERCENT } from "@/lib/membership";
import { formatPrice } from "@/lib/products";
import { RESEARCH_DISCLAIMER } from "@/lib/company";

const DISMISSED_KEY = "redline-club-invite-v1";

/** Long enough that the page the customer came for renders first. */
const DELAY_MS = 6_000;

const INVITED_ROUTES = ["/shop", "/product", "/cart"];

function shouldInvite(pathname: string) {
  return INVITED_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

function alreadySeen() {
  try {
    return localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return true;
  }
}

function remember() {
  try {
    localStorage.setItem(DISMISSED_KEY, new Date().toISOString());
  } catch {
    /* ignore quota */
  }
}

/**
 * One invitation per browser, on catalogue routes only — never on checkout,
 * the order page or /club itself, where it would interrupt a customer who is
 * already paying or already joining.
 */
export function ClubInviteModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const dismiss = useCallback(() => {
    remember();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!shouldInvite(pathname) || alreadySeen()) return;
    const timer = window.setTimeout(() => {
      if (!alreadySeen()) setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-invite-title"
        className="surface w-full max-w-[460px] p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <p className="kicker">Redline Club</p>
          <button
            ref={closeRef}
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mt-1 min-h-11 px-2 text-xl leading-none text-[#8f8c84] hover:text-[#d4af37]"
          >
            ×
          </button>
        </div>
        <h2
          id="club-invite-title"
          className="mt-2 text-[1.6rem] leading-tight font-semibold tracking-[-0.02em] text-white"
        >
          Member pricing from {formatPrice(MEMBERSHIP_PRICE_CENTS / 100)} a month.
        </h2>
        <p className="mt-3 text-sm leading-7 text-[#8f8c84]">
          Members get {MEMBER_DISCOUNT_PERCENT}% off a short list of products. The list changes on
          the 1st, and the discount applies at checkout with no code.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/club" className="btn" onClick={dismiss}>
            See membership
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 text-sm text-[#8f8c84] underline hover:text-[#d4af37]"
          >
            No thanks
          </button>
        </div>
        <p className="mt-5 text-[11px] leading-5 text-[#8f8c84]">{RESEARCH_DISCLAIMER}</p>
      </div>
    </div>
  );
}
