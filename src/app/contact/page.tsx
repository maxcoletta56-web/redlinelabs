"use client";

import { useState } from "react";
import { Field, TextAreaField } from "@/components/Field";
import { IconClock, IconMail, IconPin } from "@/components/Icons";
import { PageIntro } from "@/components/PageIntro";
import {
  COMPANY_EMAIL,
  COMPANY_NUMBER,
  LEGAL_NAME,
  REGISTERED_COMPANY_SHORT,
} from "@/lib/company";

export default function ContactPage() {
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="wrap max-w-[980px] py-16">
      <PageIntro kicker="Contact" title="Contact us">
        Questions about an order or the catalogue? The team responds during
        business hours across Australia. This storefront is operated by{" "}
        {LEGAL_NAME} (company number {COMPANY_NUMBER}). {REGISTERED_COMPANY_SHORT}
      </PageIntro>

      <div className="surface mb-12 grid md:grid-cols-3">
        {[
          {
            icon: IconMail,
            title: "Email",
            text: (
              <a href={`mailto:${COMPANY_EMAIL}`} className="hover:text-[#d4af37]">
                {COMPANY_EMAIL}
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
            <p className="text-sm text-[#8f8c84]">{item.text}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-2">
        <p className="text-[15px] leading-8 text-[#8f8c84]">
          For order assistance, product information, or general inquiries, email{" "}
          <a
            href={`mailto:${COMPANY_EMAIL}`}
            className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
          >
            {COMPANY_EMAIL}
          </a>
          . The form opens that address in your email app with the details
          filled in.
        </p>
        {opened ? (
          <p className="surface p-8 text-sm leading-7 text-[#8f8c84]">
            Your email app should have opened a message to{" "}
            <a
              href={`mailto:${COMPANY_EMAIL}`}
              className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
            >
              {COMPANY_EMAIL}
            </a>
            . If nothing opened, use that address directly.
          </p>
        ) : (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              setPending(true);
              const form = new FormData(e.currentTarget);
              const payload = {
                name: String(form.get("name") ?? ""),
                email: String(form.get("email") ?? ""),
                message: String(form.get("message") ?? ""),
                company: String(form.get("company") ?? ""),
              };
              try {
                const response = await fetch("/api/contact", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });
                const data = (await response.json()) as { error?: string; mailto?: string };
                if (!response.ok) {
                  setError(data.error ?? "Could not send this enquiry.");
                  return;
                }
                if (data.mailto) window.location.href = data.mailto;
                setOpened(true);
              } catch {
                setError("Could not send this enquiry. Email us directly instead.");
              } finally {
                setPending(false);
              }
            }}
          >
            <Field id="contact-name" label="Name" name="name" required autoComplete="name" />
            <Field id="contact-email" label="Email" name="email" type="email" required autoComplete="email" />
            <div className="hidden" aria-hidden>
              <label htmlFor="contact-company">Company</label>
              <input id="contact-company" name="company" tabIndex={-1} autoComplete="off" />
            </div>
            <TextAreaField id="contact-message" label="Message" name="message" required rows={5} />
            {error && (
              <p className="text-sm text-[#e8b4b4]" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="btn" disabled={pending}>
              {pending ? "Preparing…" : "Compose email"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
