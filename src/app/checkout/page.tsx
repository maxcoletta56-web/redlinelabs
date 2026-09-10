"use client";

import { useState } from "react";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  if (items.length === 0 && !placed) {
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

  if (placed) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <p className="kicker mb-3">Received</p>
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Thank you</h1>
        <p className="mb-8 text-sm leading-7 text-[#8f8c84]">
          This checkout is a front-end demonstration. No payment was taken and
          no order was sent to fulfillment.
        </p>
        <Link href="/shop" className="btn">
          Continue browsing
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
          onSubmit={(e) => {
            e.preventDefault();
            clear();
            setPlaced(true);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="first-name" label="First name" name="firstName" required autoComplete="given-name" />
            <Field id="last-name" label="Last name" name="lastName" required autoComplete="family-name" />
          </div>
          <Field id="email" label="Email" name="email" type="email" required autoComplete="email" />
          <Field id="address" label="Address" name="address" required autoComplete="street-address" />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="city" label="City" name="city" required autoComplete="address-level2" />
            <Field id="state" label="State" name="state" required autoComplete="address-level1" />
            <Field id="postcode" label="Postcode" name="postcode" required autoComplete="postal-code" />
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" required className="mt-1" />
            I confirm I am 18 years of age or older.
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" required className="mt-1" />
            I confirm I am purchasing this product for legitimate laboratory
            research purposes and am not purchasing it for human consumption.
          </label>
          <button type="submit" className="btn">Place order</button>
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
          Shipping is not calculated in this demonstration. See the{" "}
          <Link href="/shipping-policy" className="text-[#d4af37]">
            Shipping Policy
          </Link>{" "}
          for dispatch notes.
        </p>
      </aside>
    </div>
  );
}
