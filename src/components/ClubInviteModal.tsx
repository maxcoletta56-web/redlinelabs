"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { shouldInviteOnPath } from "@/lib/club-invite";
import { MEMBERSHIP_PRICE_CENTS, MEMBER_DISCOUNT_PERCENT } from "@/lib/membership";
import { formatPrice } from "@/lib/products";

/** New key so the membership banner shows once, even if the old points invite was dismissed. */
const DISMISSED_KEY = "redline-club-invite-v2";

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
 * One join banner per browser, on the home page and catalogue routes. Never on
 * checkout, the order page or /club, where it would interrupt someone who is
 * already paying or already joining.
 */
export function ClubInviteModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const dismiss = useCallback(() => {
    remember();
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!shouldInviteOnPath(pathname) || alreadySeen()) return;
    const timer = window.setTimeout(() => {
      if (!alreadySeen()) setOpen(true);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, dismiss]);

  if (!open) return null;

  const price = formatPrice(MEMBERSHIP_PRICE_CENTS / 100);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[45] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5">
      <aside
        className="club-invite-banner pointer-events-auto surface mx-auto flex w-full max-w-[720px] flex-col gap-4 border border-[rgba(212,175,55,0.34)] p-4 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] sm:flex-row sm:items-center sm:p-5"
        role="dialog"
        aria-modal="false"
        aria-labelledby="club-invite-title"
      >
        <div className="min-w-0 flex-1">
          <p className="kicker">Redline Club</p>
          <h2
            id="club-invite-title"
            className="mt-1 text-[1.35rem] leading-tight font-semibold tracking-[-0.02em] text-white"
          >
            Join the club
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#8f8c84]">
            {price} a month. Members get {MEMBER_DISCOUNT_PERCENT}% off a short list of products,
            applied at checkout with no code.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/club" className="btn" onClick={dismiss}>
            Join the club
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="min-h-11 px-2 text-sm text-[#8f8c84] underline hover:text-[#d4af37]"
          >
            No thanks
          </button>
        </div>
      </aside>
    </div>
  );
}
