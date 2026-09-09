"use client";

import { useState } from "react";
import { Field, TextAreaField } from "@/components/Field";
import { IconClock, IconMail, IconPin } from "@/components/Icons";
import { PageIntro } from "@/components/PageIntro";

export default function ContactPage() {
  const [sent, setSent] = useState(false);

  return (
    <div className="wrap max-w-[980px] py-16">
      <PageIntro kicker="Contact" title="Contact us">
        Questions about an order or the catalogue? The team responds during
        business hours across Australia.
      </PageIntro>

      <div className="surface mb-12 grid md:grid-cols-3">
        {[
          {
            icon: IconMail,
            title: "Email",
            text: (
              <a href="mailto:redlinelabsltd@pm.me" className="hover:text-[#d4af37]">
                redlinelabsltd@pm.me
              </a>
            ),
          },
          { icon: IconPin, title: "Dispatch", text: "Australia-wide" },
          { icon: IconClock, title: "Hours", text: "Monday–Sunday, 6AM–6PM AEST" },
        ].map((item, i) => (
          <div
            key={item.title}
            className={`p-6 ${i > 0 ? "border-t border-[rgba(212,175,55,0.16)] md:border-t-0 md:border-l" : ""}`}
          >
            <div className="mb-3 text-[#d4af37]">
              <item.icon className="h-5 w-5" />
            </div>
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.12em] text-[#d4af37] uppercase">{item.title}</h2>
            <p className="text-sm text-[#cfc8b8]">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <p className="text-[15px] leading-8 text-[#8f8c84]">
          For order assistance, product information, or general inquiries, email{" "}
          <a
            href="mailto:redlinelabsltd@pm.me"
            className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
          >
            redlinelabsltd@pm.me
          </a>
          . The form below is a demonstration and does not send a message.
        </p>
        {sent ? (
          <p className="surface p-8 text-sm leading-7 text-[#cfc8b8]">
            This contact form is a front-end demonstration. No message was sent.
            Email{" "}
            <a
              href="mailto:redlinelabsltd@pm.me"
              className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
            >
              redlinelabsltd@pm.me
            </a>{" "}
            directly.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              setSent(true);
            }}
          >
            <Field id="contact-name" label="Name" name="name" required autoComplete="name" />
            <Field id="contact-email" label="Email" name="email" type="email" required autoComplete="email" />
            <TextAreaField id="contact-message" label="Message" name="message" required rows={5} />
            <button type="submit" className="btn">Send message</button>
          </form>
        )}
      </div>
    </div>
  );
}
