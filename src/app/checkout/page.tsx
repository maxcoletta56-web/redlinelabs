"use client";

import { useState } from "react";
import Link from "next/link";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  if (items.length === 0 && !placed) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
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
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" required className="mt-1" />
            I confirm I am 18 years of age or older.
          </label>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfc8b8]">
            <input type="checkbox" required className="mt-1" />
            I confirm I am purchasing this product for legitimate laboratory
            research purposes and am not purchasing it for human consumption.
          </label>
          <button className="btn">Place order</button>
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
      </aside>
    </div>
  );
}
