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
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[rgba(212,175,55,0.2)] bg-[#090909]">
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.18)] px-5 py-5">
          <h2 className="text-lg font-semibold tracking-wide">Your Cart</h2>
          <button
            onClick={() => setDrawerOpen(false)}
            className="text-sm text-[#d4af37]"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="py-16 text-center text-[#b8b8b8]">
              <p className="mb-6">Your cart is empty</p>
              <Link
                href="/shop"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex rounded-sm bg-[#d4af37] px-5 py-3 text-xs font-bold tracking-[0.16em] text-black uppercase"
              >
                Return to Shop
              </Link>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={itemKey(item)}
                  className="flex gap-3 border-b border-white/5 pb-4"
                >
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] rounded-md object-cover"
                  />
                  <div className="flex-1">
                    <p className="font-semibold">{item.name}</p>
                    {item.option && (
                      <p className="text-xs text-[#b8b8b8]">
                        {item.variantLabel}: {item.option}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[#d4af37]">
                      {formatPrice(item.price)}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        value={item.qty}
                        onChange={(e) =>
                          updateQty(itemKey(item), Number(e.target.value) || 1)
                        }
                        className="w-16 rounded border border-[rgba(212,175,55,0.25)] bg-black px-2 py-1 text-sm"
                      />
                      <button
                        onClick={() => removeItem(itemKey(item))}
                        className="text-xs text-[#cf2e2e]"
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
          <div className="border-t border-[rgba(212,175,55,0.18)] p-5">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
            </div>
            <Link
              href="/checkout"
              onClick={() => setDrawerOpen(false)}
              className="mb-3 flex w-full items-center justify-center rounded-sm bg-[#d4af37] py-3 text-xs font-bold tracking-[0.16em] text-black uppercase"
            >
              Checkout
            </Link>
            <Link
              href="/cart"
              onClick={() => setDrawerOpen(false)}
              className="flex w-full items-center justify-center rounded-sm border border-[#d4af37] py-3 text-xs font-bold tracking-[0.16em] text-[#d4af37] uppercase"
            >
              View Cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
