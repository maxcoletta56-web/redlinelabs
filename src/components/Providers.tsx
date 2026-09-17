"use client";

import { CartProvider } from "@/lib/cart";
import { AccountProvider } from "@/lib/account";
import { CartDrawer } from "@/components/CartDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <CartProvider>
        {children}
        <CartDrawer />
      </CartProvider>
    </AccountProvider>
  );
}
