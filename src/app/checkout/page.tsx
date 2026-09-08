"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  if (items.length === 0 && !placed) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-20 text-center">
        <h1 className="font-bold mb-4 text-4xl font-medium">Checkout</h1>
        <p className="mb-6 text-[#a7a193]">Your cart is empty.</p>
        <Link href="/shop" className="text-[#d4af37]">
          Return to catalogue
        </Link>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-20 text-center">
        <p className="kicker mb-3">Received</p>
        <h1 className="font-bold mb-4 text-4xl font-medium">Thank you</h1>
        <p className="mb-8 text-sm leading-7 text-[#a7a193]">
          This is a front-end demonstration. No payment was taken and no order
          was sent to fulfillment.
        </p>
        <Link href="/shop" className="btn">
          Continue browsing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1100px] gap-12 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="font-bold mb-8 text-4xl font-medium tracking-tight">Checkout</h1>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            clear();
            setPlaced(true);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="First name" className="field" />
            <input required placeholder="Last name" className="field" />
          </div>
          <input required type="email" placeholder="Email" className="field" />
          <input required placeholder="Address" className="field" />
          <div className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="City" className="field" />
            <input required placeholder="State" className="field" />
            <input required placeholder="Postcode" className="field" />
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#a7a193]">
            <input type="checkbox" required className="mt-1" />
            I confirm these materials are for laboratory research use only and
            are not intended for human or veterinary use.
          </label>
          <button className="btn">Place order</button>
        </form>
      </div>
      <aside className="h-fit border border-[rgba(212,175,55,0.14)] p-6">
        <h2 className="font-bold mb-4 text-2xl font-medium">Summary</h2>
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
        <div className="flex justify-between border-t border-[rgba(212,175,55,0.14)] pt-4">
          <span>Subtotal</span>
          <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
        </div>
      </aside>
    </div>
  );
}
