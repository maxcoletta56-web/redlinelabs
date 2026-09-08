"use client";

import Image from "next/image";
import Link from "next/link";
import { itemKey, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();

  return (
    <div className="mx-auto max-w-[980px] px-5 py-16">
      <h1 className="font-bold mb-10 text-4xl font-medium tracking-tight">Cart</h1>
      {items.length === 0 ? (
        <div className="border border-[rgba(212,175,55,0.14)] p-12 text-center">
          <p className="mb-6 text-[#a7a193]">Your cart is empty.</p>
          <Link href="/shop" className="btn">
            Return to catalogue
          </Link>
        </div>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
          <ul className="space-y-4">
            {items.map((item) => (
              <li
                key={itemKey(item)}
                className="flex gap-4 border border-[rgba(212,175,55,0.14)] p-4"
              >
                <Image
                  src={item.image}
                  alt={item.name}
                  width={88}
                  height={88}
                  className="h-[88px] w-[88px] object-cover"
                />
                <div className="flex-1">
                  <p className="font-bold text-xl font-medium">{item.name}</p>
                  {item.option && (
                    <p className="text-sm text-[#a7a193]">
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
                      className="field w-16 py-1"
                    />
                    <button
                      onClick={() => removeItem(itemKey(item))}
                      className="text-sm text-[#a7a193] hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="h-fit border border-[rgba(212,175,55,0.14)] p-6">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
            </div>
            <p className="mb-4 text-xs leading-6 text-[#7d786c]">
              Shipping is calculated at checkout. Australia-wide dispatch.
            </p>
            <Link href="/checkout" className="btn w-full">
              Continue to checkout
            </Link>
          </aside>
        </div>
      )}
    </div>
  );
}
