"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ProductImage } from "@/components/ProductImage";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { MAX_QTY, itemKey, useCart } from "@/lib/cart";
import { checkoutTotals } from "@/lib/promo";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

export function CartDrawer() {
  const { items, drawerOpen, setDrawerOpen, updateQty, removeItem } =
    useCart();
  const { promo } = usePromo();
  const totals = checkoutTotals({ items, promo });
  const closeRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!drawerOpen) return;
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
      previouslyFocused.current?.focus();
    };
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
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[rgba(212,175,55,0.16)] bg-[#080808]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
      >
        <div className="flex items-center justify-between border-b border-[rgba(212,175,55,0.16)] px-6 py-5">
          <h2 id="cart-drawer-title" className="text-[15px] font-medium tracking-[0.08em] uppercase">Cart</h2>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="text-[12px] tracking-[0.08em] text-[#d4af37] uppercase"
          >
            Close
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {items.length === 0 ? (
            <div className="py-16 text-center text-[#8f8c84]">
              <p className="mb-6 text-sm">Your cart is empty.</p>
              <Link href="/shop" onClick={() => setDrawerOpen(false)} className="btn">
                Return to catalogue
              </Link>
            </div>
          ) : (
            <ul className="space-y-5">
              {items.map((item) => (
                <li key={itemKey(item)} className="flex gap-3 border-b border-[rgba(212,175,55,0.16)] pb-5">
                  <ProductImage
                    src={item.image}
                    alt={`${item.name} research vial`}
                    width={72}
                    height={72}
                    className="h-[72px] w-[72px] border border-[rgba(212,175,55,0.16)] object-contain"
                  />
                  <div className="flex-1">
                    <Link
                      href={`/product/${item.slug}`}
                      onClick={() => setDrawerOpen(false)}
                      className="text-[14px] font-medium text-white hover:text-[#d4af37]"
                    >
                      {item.name}
                    </Link>
                    {item.option && (
                      <p className="text-xs text-[#8f8c84]">
                        {optionLabel(item, item.option)}
                      </p>
                    )}
                    <p className="mt-1 text-sm text-[#d4af37]">{formatPrice(item.price)}</p>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="number"
                        min={1}
                        max={MAX_QTY}
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
                        className="text-xs text-[#8f8c84] hover:text-[#d4af37]"
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
          <div className="border-t border-[rgba(212,175,55,0.16)] p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">
                {formatPrice(centsToDollars(totals.catalogCents))}
              </span>
            </div>
            <PromoCodeForm id="drawer-checkout-code" />
            {totals.volumeDiscountCents > 0 && (
              <div className="mb-4 flex justify-between text-sm">
                <span>10% off $200+</span>
                <span className="text-[#d4af37]">
                  −{formatPrice(centsToDollars(totals.volumeDiscountCents))}
                </span>
              </div>
            )}
            {totals.promoDiscountCents > 0 && (
              <div className="mb-4 flex justify-between text-sm">
                <span>{promo?.percentOff}% off total</span>
                <span className="text-[#d4af37]">
                  −{formatPrice(centsToDollars(totals.promoDiscountCents))}
                </span>
              </div>
            )}
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
