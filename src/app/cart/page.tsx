"use client";

import { ProductImage } from "@/components/ProductImage";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { itemKey, useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, subtotal, updateQty, removeItem } = useCart();

  return (
    <div className="wrap max-w-[980px] py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Cart" }]} />
      <p className="kicker mb-3">Order</p>
      <h1 className="mb-10 text-[2.15rem] font-semibold tracking-[-0.03em] text-white">Cart</h1>
      {items.length === 0 ? (
        <div className="surface p-12 text-center">
          <p className="mb-6 text-sm text-[#8f8c84]">Your cart is empty.</p>
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
                className="surface flex gap-4 p-4"
              >
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  width={88}
                  height={88}
                  className="h-[88px] w-[88px] object-contain"
                />
                <div className="flex-1">
                  <p className="text-[16px] font-medium text-white">{item.name}</p>
                  {item.option && (
                    <p className="text-sm text-[#8f8c84]">
                      {item.variantLabel}: {item.option}
                    </p>
                  )}
                  <p className="mt-1 text-[#d4af37]">{formatPrice(item.price)}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-[#8f8c84]">
                      <span className="sr-only">Quantity for {item.name}</span>
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
                    </label>
                    <button
                      type="button"
                      onClick={() => removeItem(itemKey(item))}
                      className="text-sm text-[#8f8c84] hover:text-white"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <aside className="surface h-fit p-6">
            <div className="mb-4 flex justify-between text-sm">
              <span>Subtotal</span>
              <span className="text-[#d4af37]">{formatPrice(subtotal)}</span>
            </div>
            <p className="mb-4 text-xs leading-6 text-[#8f8c84]">
              This demonstration does not calculate shipping. Live dispatch is
              described on the{" "}
              <Link href="/shipping-policy" className="text-[#d4af37]">
                Shipping Policy
              </Link>
              .
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
