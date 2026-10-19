"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { shouldKeepInviteOpen } from "@/lib/club-invite";
import { MEMBERSHIP_PRICE_CENTS, MEMBER_DISCOUNT_PERCENT } from "@/lib/membership";
import { formatPrice } from "@/lib/products";

/** New key so the large popup shows once, even if the smaller banner was dismissed. */
const DISMISSED_KEY = "redline-club-invite-v3";

/** Long enough that the page the customer came for renders first. */
const DELAY_MS = 1_500;

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
 * One large join popup per browser, on the home page and catalogue routes.
 * Never on checkout, the order page or /club, where it would interrupt someone
 * who is already paying or already joining.
 */
export function ClubInviteModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const dismiss = useCallback(() => {
    remember();
    setOpen(false);
  }, []);

  // Providers keeps this mounted, and the cart drawer (z-50) can navigate to
  // checkout while this layer (z-[45]) is still open. Hide from the path so
  // that navigation unmounts the dialog and releases the scroll lock.
  const visible = open && shouldKeepInviteOpen(pathname, false);

  useEffect(() => {
    if (!shouldKeepInviteOpen(pathname, alreadySeen())) return;
    const timer = window.setTimeout(() => {
      if (shouldKeepInviteOpen(pathname, alreadySeen())) setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!visible) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [visible, dismiss]);

  if (!visible) return null;

  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);

  return (
    <div
      className="fixed inset-0 z-[45] flex items-end justify-center bg-black/80 p-3 sm:items-center sm:p-8"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <aside
        className="club-invite-banner surface relative max-h-[calc(100dvh-1.5rem)] w-full max-w-[680px] overflow-y-auto border border-[rgba(212,175,55,0.45)] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-12"
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-invite-title"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="absolute top-3 right-3 min-h-11 min-w-11 text-2xl leading-none text-[#8f8c84] hover:text-[#d4af37]"
        >
          ×
        </button>
        <p className="kicker">Redline Club</p>
        <h2
          id="club-invite-title"
          className="mt-3 text-[2.6rem] leading-[0.95] font-semibold tracking-[-0.04em] text-white sm:text-[4rem]"
        >
          Join the club
        </h2>
        <p className="mt-5 text-[2rem] leading-none font-semibold tracking-[-0.03em] text-white sm:text-[2.6rem]">
          {price}
          <span className="ml-2 text-lg font-medium text-[#8f8c84] sm:text-xl">/ month</span>
        </p>
        <p className="mt-5 max-w-[34rem] text-base leading-7 text-[#cfc8b8] sm:text-lg">
          Members get {MEMBER_DISCOUNT_PERCENT}% off a short list of products. The list changes on
          the 1st, and the price applies at checkout with no code.
        </p>
        <ul className="mt-6 space-y-2 text-sm leading-6 text-[#cfc8b8] sm:text-base">
          <li>Discounts apply automatically</li>
          <li>New offers refresh monthly</li>
          <li>Cancel anytime — access lasts until the period you paid for ends</li>
        </ul>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/club" className="btn min-h-14 w-full px-8 text-[13px] sm:w-auto" onClick={dismiss}>
            Join the club
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="min-h-11 text-sm text-[#8f8c84] underline hover:text-[#d4af37]"
          >
            No thanks
          </button>
        </div>
      </aside>
    </div>
  );
}
