"use client";

import { useEffect, useState } from "react";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("rl-popup")) return;
    const t = setTimeout(() => setOpen(true), 1800);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/75"
        onClick={() => {
          sessionStorage.setItem("rl-popup", "1");
          setOpen(false);
        }}
        aria-label="Dismiss offer"
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-[rgba(212,175,55,0.3)] bg-[#0b0b0b] p-8 text-center shadow-[0_0_80px_rgba(212,175,55,0.15)]">
        <p className="mb-2 text-xs tracking-[0.28em] text-[#d4af37] uppercase">
          Especially for you
        </p>
        <h3 className="gold-text mb-2 text-4xl font-extrabold">15% OFF</h3>
        <p className="mb-6 text-sm text-[#cfcfcf]">
          Sign up below to unlock 15% off Retatrutide. Be the first to hear
          about special offers, new product releases, and availability.
        </p>
        {done ? (
          <p className="text-sm text-[#d4af37]">
            Check your inbox or spam folder to confirm your subscription.
          </p>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              setDone(true);
              sessionStorage.setItem("rl-popup", "1");
            }}
          >
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full rounded-sm border border-[rgba(212,175,55,0.3)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <button
              type="submit"
              className="w-full rounded-sm bg-[#d4af37] py-3 text-xs font-bold tracking-[0.18em] text-black uppercase"
            >
              Join the list
            </button>
          </form>
        )}
        <p className="mt-4 text-[11px] text-[#8d8d8d]">
          We don’t spam. Read our{" "}
          <a href="/privacy-policy" className="text-[#d4af37] underline">
            privacy policy
          </a>{" "}
          for more info.
        </p>
      </div>
    </div>
  );
}
