"use client";

import Image from "next/image";
import Link from "next/link";
import { itemKey, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-[1000px] px-5 py-16">
      <h1 className="mb-8 text-4xl font-bold">Your Cart</h1>
      {items.length === 0 ? (
        <div className="rounded-2xl border border-[rgba(212,175,55,0.18)] p-12 text-center">
          <p className="mb-6 text-[#cfcfcf]">Your cart is empty</p>
          <Link
            href="/shop"
            className="inline-flex rounded-sm bg-[#d4af37] px-6 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase"
          >
            Return to Shop
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
          <ul className="space-y-5">
            {items.map((item) => (
              <li
                key={itemKey(item)}
                className="flex gap-4 rounded-2xl border border-[rgba(212,175,55,0.15)] p-4"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  width={88}
                  height={88}
                  className="h-[88px] w-[88px] rounded-md object-cover"
                />
                <div className="flex-1">
                  <p className="font-semibold">{item.name}</p>
                  {item.option && (
                    <p className="text-sm text-[#b8b8b8]">
                      {item.variantLabel}: {item.option}
                    </p>
                  )}
                  <p className="mt-1 text-[#d4af37]">{formatPrice(item.price)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={(e) =>
                        updateQty(itemKey(item), Number(e.target.value) || 1)
                      }
                      className="w-16 rounded border border-[rgba(212,175,55,0.25)] bg-black px-2 py-1"
                    />
                    <button
                      onClick={() => removeItem(itemKey(item))}
                      className="text-sm text-[#cf2e2e]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit rounded-2xl border border-[rgba(212,175,55,0.18)] p-6">
            <div className="mb-4 flex justify-between">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
            </div>
            <p className="mb-4 text-xs text-[#9a9a9a]">
              Shipping is calculated at checkout. Australia-wide dispatch.
            </p>
            <Link
              href="/checkout"
              className="flex w-full items-center justify-center rounded-sm bg-[#d4af37] py-3 text-xs font-bold tracking-[0.16em] text-black uppercase"
            >
              Continue to checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
