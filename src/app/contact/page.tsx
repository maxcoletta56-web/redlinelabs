"use client";

import { useState } from "react";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-[1100px] px-5 py-16">
      <p className="mb-3 text-xs tracking-[0.28em] text-[#d4af37] uppercase">
        Contact Redline Labs
      </p>
      <h1 className="mb-4 text-4xl font-bold">Let&apos;s Start A Conversation</h1>
      <p className="mb-12 max-w-2xl text-base leading-8 text-[#cfcfcf]">
        Have questions about our products or need assistance? Our team is here
        to help and provide the information you need.
      </p>

      <div className="mb-12 grid gap-5 md:grid-cols-3">
        {[
          { icon: "📧", title: "Email Support", text: "redlinelabsltd@pm.me" },
          { icon: "📍", title: "Location", text: "Serving customers Australia-wide" },
          { icon: "⏰", title: "Business Hours", text: "Monday – Sunday | 6AM – 6PM" },
        ].map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-[rgba(212,175,55,0.18)] p-6"
          >
            <div className="mb-3 text-2xl">{item.icon}</div>
            <h2 className="mb-1 text-lg font-semibold text-[#d4af37]">{item.title}</h2>
            <p className="text-sm text-[#cfcfcf]">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-2xl font-bold">Why Contact Us?</h2>
          <p className="text-sm leading-8 text-[#c8c8c8]">
            Whether you need assistance with an order, product information, or
            general inquiries, our team is committed to providing a professional
            and timely response.
          </p>
        </div>
        {sent ? (
          <p className="rounded-2xl border border-[rgba(212,175,55,0.25)] p-8 text-[#d4af37]">
            Message received. We&apos;ll get back to you as soon as possible.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <input
              required
              placeholder="Name"
              className="w-full rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <input
              required
              type="email"
              placeholder="Email"
              className="w-full rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <textarea
              required
              rows={5}
              placeholder="Message"
              className="w-full rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]"
            />
            <button className="rounded-sm bg-[#d4af37] px-6 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase">
              Send Message
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
