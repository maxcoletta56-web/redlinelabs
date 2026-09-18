"use client";

import { CartProvider } from "@/lib/cart";
import { AccountProvider } from "@/lib/account";
import { AssistLoopWidget } from "@/components/AssistLoopWidget";
import { CartDrawer } from "@/components/CartDrawer";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AccountProvider>
      <CartProvider>
        {children}
        <CartDrawer />
        <AssistLoopWidget />
      </CartProvider>
    </AccountProvider>
  );
}
