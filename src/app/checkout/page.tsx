"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

const fieldClass =
  "w-full rounded-sm border border-[rgba(212,175,55,0.25)] bg-black px-4 py-3 text-sm outline-none focus:border-[#d4af37]";

export default function CheckoutPage() {
  const { items, subtotal, clear } = useCart();
  const [placed, setPlaced] = useState(false);

  if (items.length === 0 && !placed) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold">Checkout</h1>
        <p className="mb-6 text-[#cfcfcf]">Your cart is empty.</p>
        <Link href="/shop" className="text-[#d4af37] underline">
          Return to shop
        </Link>
      </div>
    );
  }

  if (placed) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-20 text-center">
        <p className="mb-3 text-xs tracking-[0.24em] text-[#d4af37] uppercase">
          Order received
        </p>
        <h1 className="mb-4 text-3xl font-bold">Thank you</h1>
        <p className="mb-8 text-sm leading-7 text-[#cfcfcf]">
          This storefront is a demo rebuild. No payment was taken and no order
          was sent to fulfillment. Connect a payment provider when you are
          ready to go live.
        </p>
        <Link
          href="/shop"
          className="inline-flex rounded-sm bg-[#d4af37] px-6 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-[1100px] gap-10 px-5 py-16 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <h1 className="mb-6 text-4xl font-bold">Checkout</h1>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            clear();
            setPlaced(true);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="First name" className={fieldClass} />
            <input required placeholder="Last name" className={fieldClass} />
          </div>
          <input required type="email" placeholder="Email" className={fieldClass} />
          <input required placeholder="Address" className={fieldClass} />
          <div className="grid gap-4 sm:grid-cols-3">
            <input required placeholder="City" className={fieldClass} />
            <input required placeholder="State" className={fieldClass} />
            <input required placeholder="Postcode" className={fieldClass} />
          </div>
          <label className="flex items-start gap-3 text-sm leading-6 text-[#cfcfcf]">
            <input type="checkbox" required className="mt-1" />
            I confirm these materials are for laboratory research use only and
            are not intended for human or veterinary use.
          </label>
          <button className="rounded-sm bg-[#d4af37] px-6 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase">
            Place order
          </button>
        </form>
      </div>
      <aside className="h-fit rounded-2xl border border-[rgba(212,175,55,0.18)] p-6">
        <h2 className="mb-4 text-lg font-semibold">Order summary</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={`${item.slug}-${item.option}`} className="flex justify-between gap-4">
              <span>
                {item.name}
                {item.option ? ` (${item.option})` : ""} × {item.qty}
              </span>
              <span className="text-[#d4af37]">
                {formatPrice(item.price * item.qty)}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-white/10 pt-4">
          <span>Subtotal</span>
          <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
        </div>
      </aside>
    </div>
  );
}
