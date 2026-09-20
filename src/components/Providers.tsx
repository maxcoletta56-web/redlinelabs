"use client";

import { CartProvider } from "@/lib/cart";
import { AccountProvider } from "@/lib/account";
import { PromoProvider } from "@/lib/promo-state";
import { CartDrawer } from "@/components/CartDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <CartProvider>
        <PromoProvider>
          {children}
          <CartDrawer />
        </PromoProvider>
      </CartProvider>
    </AccountProvider>
  );
}
