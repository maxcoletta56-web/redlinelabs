"use client";

import { useState } from "react";
import { Field } from "@/components/Field";

export function NewsletterForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <p className="mx-auto max-w-md text-sm leading-7 text-[#8f8c84]">
        This form is a front-end demonstration and does not start a mailing list.
        For catalogue updates, email{" "}
        <a
          href="mailto:redlinelabsltd@pm.me"
          className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
        >
          redlinelabsltd@pm.me
        </a>
        .
      </p>
    );
  }

  return (
    <form
      className="mx-auto flex max-w-md flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
    >
      <div className="min-w-0 flex-1 text-left">
        <Field
          id="newsletter-email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
      </div>
      <button type="submit" className="btn sm:mb-px">
        Submit
      </button>
    </form>
  );
}
