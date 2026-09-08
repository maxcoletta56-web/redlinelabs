"use client";

import Image from "next/image";
import Link from "next/link";
import { itemKey, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export function CartDrawer() {
  const { items, subtotal, drawerOpen, setDrawerOpen, updateQty, removeItem } =
    useCart();

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/70"
        onClick={() => setDrawerOpen(false)}
        aria-label="Close cart"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[rgba(212,175,55,0.16)] bg-[#0a0a0a]">
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.14)] px-6 py-5">
          <h2 className="font-serif text-2xl font-medium">Cart</h2>
          <button onClick={() => setDrawerOpen(false)} className="text-sm text-[#d4af37]">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="py-16 text-center text-[#a7a193]">
              <p className="mb-6">Your cart is empty.</p>
              <Link href="/shop" onClick={() => setDrawerOpen(false)} className="btn">
                Return to catalogue
              </Link>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={itemKey(item)} className="flex gap-3 border-b border-white/5 pb-5">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-serif text-lg font-medium">{item.name}</p>
                    {item.option && (
                      <p className="text-xs text-[#a7a193]">
                        {item.variantLabel}: {item.option}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[#d4af37]">{formatPrice(item.price)}</p>
                    <div className="mt-2 flex items-center gap-3">
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
                        className="text-xs text-[#a7a193] hover:text-white"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {items.length > 0 && (
          <div className="border-t border-[rgba(212,175,55,0.14)] p-6">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setDrawerOpen(false)}
              className="btn mb-3 w-full"
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              onClick={() => setDrawerOpen(false)}
              className="btn-outline w-full"
            >
              View cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
