"use client";

import { useEffect, useState } from "react";

export function NewsletterPopup() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("rl-popup")) return;
    const t = setTimeout(() => setOpen(true), 9000);
    return () => clearTimeout(t);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        className="absolute inset-0 bg-black/70"
        onClick={() => {
          sessionStorage.setItem("rl-popup", "1");
          setOpen(false);
        }}
        aria-label="Dismiss offer"
      />
      <div className="relative w-full max-w-md border border-[rgba(212,175,55,0.28)] bg-[#0c0c0c] p-8">
        <p className="mb-2 text-[11px] tracking-[0.22em] text-[#d4af37] uppercase">
          Subscriber offer
        </p>
        <h3 className="mb-2 text-2xl font-semibold">15% off Retatrutide</h3>
        <p className="mb-6 text-sm leading-7 text-[#c8c8c8]">
          Join the list for availability updates and a one-time catalogue offer.
        </p>
        {done ? (
          <p className="text-sm text-[#d4af37]">
            Check your inbox to confirm the subscription.
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
              className="w-full border border-[rgba(212,175,55,0.28)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <button
              type="submit"
              className="w-full bg-[#d4af37] py-3 text-[11px] font-semibold tracking-[0.16em] text-black uppercase"
            >
              Join the list
            </button>
          </form>
        )}
        <button
          className="mt-4 text-xs text-[#8d8d8d] underline"
          onClick={() => {
            sessionStorage.setItem("rl-popup", "1");
            setOpen(false);
          }}
        >
          No thanks
        </button>
      </div>
    </div>
  );
}
