"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { itemKey, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export function CartDrawer() {
  const { items, subtotal, drawerOpen, setDrawerOpen, updateQty, removeItem } =
    useCart();

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, setDrawerOpen]);

  if (!drawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        className="absolute inset-0 bg-black/70"
        onClick={() => setDrawerOpen(false)}
        aria-label="Close cart"
      />
      <aside
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[#ececef] bg-white"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-[#ececef] px-6 py-5">
          <h2 id="cart-drawer-title" className="text-[15px] font-medium tracking-[0.08em] uppercase">Cart</h2>
          <button type="button" onClick={() => setDrawerOpen(false)} className="text-[12px] tracking-[0.08em] text-[#e11d2e] uppercase">
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="py-16 text-center text-[#5c5c64]">
              <p className="mb-6 text-sm">Your cart is empty.</p>
              <Link href="/shop" onClick={() => setDrawerOpen(false)} className="btn">
                Return to catalogue
              </Link>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={itemKey(item)} className="flex gap-3 border-b border-[#ececef] pb-5">
                  <Image
                    src={item.image}
                    alt={item.name}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] border border-[#ececef] object-contain"
                  />
                  <div className="flex-1">
                    <p className="text-[14px] font-medium text-[#0b0b0c]">{item.name}</p>
                    {item.option && (
                      <p className="text-xs text-[#5c5c64]">
                        {item.variantLabel}: {item.option}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[#e11d2e]">{formatPrice(item.price)}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        aria-label={`Quantity for ${item.name}`}
                        value={item.qty}
                        onChange={(e) =>
                          updateQty(itemKey(item), Number(e.target.value) || 1)
                        }
                        className="field w-16 py-1"
                      />
                      <button
                        type="button"
                        onClick={() => removeItem(itemKey(item))}
                        className="text-xs text-[#5c5c64] hover:text-[#e11d2e]"
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
          <div className="border-t border-[#ececef] p-6">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#e11d2e]">{formatPrice(subtotal)}</span>
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
              className="btn-ghost w-full"
            >
              View cart
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
