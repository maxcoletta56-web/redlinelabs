"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CheckoutPage() {
  const { items, subtotal } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => setConfigured(Boolean(data.configured)))
      .catch(() => setConfigured(false));
  }, []);

  if (items.length === 0) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/cart", label: "Cart" }, { label: "Checkout" }]} />
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Checkout</h1>
        <p className="mb-6 text-sm text-[#8f8c84]">Your cart is empty.</p>
        <Link href="/shop" className="text-[#d4af37]">
          Return to catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap grid max-w-[1100px] gap-12 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <Breadcrumbs
          items={[
            { href: "/", label: "Home" },
            { href: "/cart", label: "Cart" },
            { label: "Checkout" },
          ]}
        />
        <p className="kicker mb-3">Order</p>
        <h1 className="mb-6 text-[2.15rem] font-semibold tracking-[-0.03em]">Checkout</h1>
        <ResearchDisclaimer className="mb-8" />
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setError(null);
            setPending(true);
            const form = new FormData(event.currentTarget);
            try {
              const response = await fetch("/api/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  firstName: String(form.get("firstName") ?? ""),
                  lastName: String(form.get("lastName") ?? ""),
                  email: String(form.get("email") ?? ""),
                  ageConfirmed: form.get("ageConfirmed") === "on",
                  researchUse: form.get("researchUse") === "on",
                  items: items.map((item) => ({
                    slug: item.slug,
                    option: item.option,
                    qty: item.qty,
                  })),
                }),
              });
              const data = (await response.json()) as { url?: string; error?: string };
              if (!response.ok || !data.url) {
                throw new Error(data.error || "Stripe checkout could not start");
              }
              window.location.href = data.url;
            } catch (err) {
              setError(err instanceof Error ? err.message : "Stripe checkout could not start");
              setPending(false);
            }
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first-name" label="First name" name="firstName" required autoComplete="given-name" />
            <Field id="last-name" label="Last name" name="lastName" required autoComplete="family-name" />
          </div>
          <Field id="email" label="Email" name="email" type="email" required autoComplete="email" />
          <p className="text-sm leading-6 text-[#8f8c84]">
            Stripe collects billing and Australian shipping details on the next
            page. Card data never touches this site.
          </p>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" name="ageConfirmed" required className="mt-1" />
            I confirm I am 18 years of age or older.
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" name="researchUse" required className="mt-1" />
            I confirm I am purchasing this product for legitimate laboratory
            research purposes and am not purchasing it for human consumption.
          </label>
          {error && (
            <p className="text-sm leading-6 text-[#e8b4b4]" role="alert">
              {error}
            </p>
          )}
          {configured === false && (
            <p className="text-sm leading-6 text-[#e8b4b4]" role="status">
              Stripe is not configured on this server yet. Add{" "}
              <code className="text-[#d4af37]">STRIPE_SECRET_KEY</code> to the
              environment, then reload.
            </p>
          )}
          <button type="submit" className="btn" disabled={pending || configured === false}>
            {pending ? "Redirecting to Stripe…" : "Pay with Stripe"}
          </button>
        </form>
      </div>
      <aside className="surface h-fit p-6">
        <h2 className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase">Summary</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={`${item.slug}-${item.option}`} className="flex justify-between gap-4">
              <span>
                {item.name}
                {item.option ? ` (${item.option})` : ""} × {item.qty}
              </span>
              <span className="text-[#d4af37]">{formatPrice(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>Subtotal</span>
          <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#8f8c84]">
          Prices charged by Stripe are taken from the catalogue, not from the
          browser cart. See the{" "}
          <Link href="/shipping-policy" className="text-[#d4af37]">
            Shipping Policy
          </Link>{" "}
          for dispatch notes.
        </p>
      </aside>
    </div>
  );
}
