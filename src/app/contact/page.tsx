"use client";

import { useState } from "react";
import { IconClock, IconMail, IconPin } from "@/components/Icons";
import { PageIntro } from "@/components/PageIntro";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="mx-auto max-w-[980px] px-5 py-16">
      <PageIntro kicker="Contact" title="Start a conversation.">
        Questions about an order or the catalogue? The team responds during
        business hours across Australia.
      </PageIntro>

      <div className="mb-12 grid border border-[rgba(212,175,55,0.14)] md:grid-cols-3">
        {[
          { icon: IconMail, title: "Email", text: "redlinelabsltd@pm.me" },
          { icon: IconPin, title: "Dispatch", text: "Australia-wide" },
          { icon: IconClock, title: "Hours", text: "Monday–Sunday, 6AM–6PM" },
        ].map((item, i) => (
          <div
            key={item.title}
            className={`p-6 ${i > 0 ? "border-t border-[rgba(212,175,55,0.14)] md:border-t-0 md:border-l" : ""}`}
          >
            <div className="mb-3 text-[#d4af37]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mb-1 text-sm font-medium text-[#d4af37]">{item.title}</h2>
            <p className="text-sm text-[#cfc8b8]">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <p className="text-[15px] leading-8 text-[#a7a193]">
          For order assistance, product information, or general inquiries, we
          aim to reply promptly and clearly.
        </p>
        {sent ? (
          <p className="border border-[rgba(212,175,55,0.2)] p-8 text-[#d4af37]">
            Message received. We will reply as soon as possible.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <input required placeholder="Name" className="field" />
            <input required type="email" placeholder="Email" className="field" />
            <textarea required rows={5} placeholder="Message" className="field" />
            <button className="btn">Send message</button>
          </form>
        )}
      </div>
    </div>
  );
}
