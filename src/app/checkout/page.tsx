"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CartCheckout } from "@/components/CartCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import { defaultAddress, formatAddress, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { checkoutTotals } from "@/lib/promo";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars, creditToApplyCents } from "@/lib/store-credit";

function shippingFromAddress(address: SavedAddress): ShippingAddressInput {
  return {
    name: `${address.firstName} ${address.lastName}`.trim(),
    line1: address.line1,
    line2: address.line2 || undefined,
    city: address.city,
    state: address.state,
    postal_code: address.postcode,
    country: "AU",
  };
}

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then((data: { configured?: boolean; publishableKey?: string | null }) => {
        const key =
          typeof data.publishableKey === "string" && data.publishableKey.startsWith("pk_")
            ? data.publishableKey
            : null;
        setPublishableKey(key);
        setConfigured(Boolean(data.configured) && Boolean(key));
      })
      .catch(() => {
        setConfigured(false);
        setPublishableKey(null);
      });
  }, []);

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const totals = checkoutTotals({
    items,
    promo,
  });
  const creditCents = creditToApplyCents(
    user?.storeCreditCents ?? 0,
    totals.discountedCents,
  );
  const payable = centsToDollars(totals.discountedCents - creditCents);

  const cartItems = useMemo(
    () =>
      items.map((item) => ({
        slug: item.slug,
        option: item.option,
        qty: item.qty,
      })),
    [items],
  );

  if (items.length === 0) {
    return (
      <div className="wrap max-w-[700px] py-20 text-center">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { href: "/cart", label: "Cart" }, { label: "Checkout" }]} />
        <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em]">Checkout</h1>
        <p className="mb-6 text-sm text-[#8f8c84]">Your cart is empty.</p>
        <Link href="/shop" className="text-[#d4af37]">
          Return to catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="wrap max-w-[1100px] py-16">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/cart", label: "Cart" },
          { label: "Checkout" },
        ]}
      />
      <p className="kicker mb-3">Order</p>
      <h1 className="mb-6 text-[2.15rem] font-semibold tracking-[-0.03em]">Checkout</h1>
      <ResearchDisclaimer className="mb-8" />
      <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
      <div className="order-2 lg:order-1">

        {hydrated && !user && (
          <aside className="surface mb-8 p-5" role="note">
            <p className="text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
              Account required for profile benefits
            </p>
            <p className="mt-2 text-sm leading-6 text-[#8f8c84]">
              Sign in to apply store credit automatically, auto-fill saved
              addresses, and keep full order history with COAs and tracking.
            </p>
            <Link href="/account?next=/checkout" className="btn mt-4">
              Sign in or create account
            </Link>
          </aside>
        )}

        {!ready ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const form = new FormData(event.currentTarget);
              if (form.get("ageConfirmed") !== "on" || form.get("researchUse") !== "on") {
                setError("Age and research-use confirmation are required");
                return;
              }
              setCustomer({
                firstName,
                lastName,
                email,
              });
              setReady(true);
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                id="first-name"
                label="First name"
                name="firstName"
                required
                autoComplete="given-name"
                value={firstName}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, firstName: event.target.value }))
                }
              />
              <Field
                id="last-name"
                label="Last name"
                name="lastName"
                required
                autoComplete="family-name"
                value={lastName}
                onChange={(event) =>
                  setCustomer((current) => ({ ...current, lastName: event.target.value }))
                }
              />
            </div>
            <Field
              id="email"
              label="Email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) =>
                setCustomer((current) => ({ ...current, email: event.target.value }))
              }
            />
            {user && user.addresses.length > 0 && (
              <fieldset>
                <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                  Saved address
                </legend>
                <div className="space-y-2">
                  {user.addresses.map((address) => (
                    <label
                      key={address.id}
                      className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6"
                    >
                      <input
                        type="radio"
                        name="savedAddress"
                        className="mt-1"
                        checked={(addressId || selectedAddress?.id) === address.id}
                        onChange={() => setAddressId(address.id)}
                      />
                      <span>
                        <span className="block font-medium text-white">
                          {address.label}
                          {address.isDefault ? " · default" : ""}
                        </span>
                        <span className="text-[#8f8c84]">{formatAddress(address)}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-xs text-[#8f8c84]">
                  Stripe will auto-fill this Australian shipping address.{" "}
                  <Link href="/account#addresses" className="text-[#d4af37]">
                    Edit addresses
                  </Link>
                </p>
              </fieldset>
            )}
            <p className="text-sm leading-6 text-[#8f8c84]">
              Payment stays on this page. Stripe collects the card and Australian
              shipping address inside the embedded checkout. After a card payment
              it does not redirect away.
            </p>
            <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
              <input type="checkbox" name="ageConfirmed" required className="mt-1" />
              I confirm I am 18 years of age or older.
            </label>
            <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
              <input type="checkbox" name="researchUse" required className="mt-1" />
              I confirm I am purchasing this product for legitimate laboratory
              research purposes and am not purchasing it for human consumption.
            </label>
            {error && (
              <p className="text-sm leading-6 text-[#d4af37]" role="alert">
                {error}
              </p>
            )}
            {configured === false && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Stripe live checkout is not configured. Add{" "}
                <code className="text-[#d4af37]">STRIPE_SECRET_KEY</code>{" "}
                (<code className="text-[#d4af37]">sk_live_...</code>) and{" "}
                <code className="text-[#d4af37]">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code>{" "}
                (<code className="text-[#d4af37]">pk_live_...</code>). Test keys
                are ignored on the live site.
              </p>
            )}
            <button type="submit" className="btn" disabled={configured !== true}>
              Continue to payment
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Paying as {email}. Card details are handled by Stripe.
              {promo
                ? ` ${promo.percentOff}% off the total order amount is applied automatically.`
                : ""}
              {creditCents > 0
                ? ` ${formatPrice(centsToDollars(creditCents))} store credit will be applied automatically.`
                : ""}
            </p>
            <div className="surface overflow-hidden p-3">
              {publishableKey ? (
                <CartCheckout
                  items={cartItems}
                  email={email}
                  firstName={firstName}
                  lastName={lastName}
                  publishableKey={publishableKey}
                  shipping={selectedAddress ? shippingFromAddress(selectedAddress) : null}
                  storeCreditCents={creditCents}
                  promoCode={promo?.code ?? null}
                />
              ) : (
                <p className="text-sm leading-6 text-[#d4af37]" role="status">
                  Stripe checkout is not available.
                </p>
              )}
            </div>
            <button type="button" className="btn-ghost" onClick={() => setReady(false)}>
              Edit details
            </button>
          </div>
        )}
      </div>
      <aside className="surface order-1 h-fit p-6 lg:order-2">
        <h2 className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase">Summary</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {items.map((item) => (
            <li key={`${item.slug}-${item.option}`} className="flex justify-between gap-4">
              <span>
                {item.name}
                {item.option ? ` (${optionLabel(item, item.option)})` : ""} × {item.qty}
              </span>
              <span className="text-[#d4af37]">{formatPrice(item.price * item.qty)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4 text-sm">
          <span>Subtotal</span>
          <span className="text-[#d4af37]">{formatPrice(centsToDollars(totals.catalogCents))}</span>
        </div>
        {totals.discountCents > 0 && (
          <div className="mb-3 mt-3 flex justify-between text-sm">
            <span>{promo.percentOff}% off total</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(totals.discountCents))}
            </span>
          </div>
        )}
        <div className="mt-3 flex justify-between text-sm">
          <span>Store credit</span>
          <span className="text-[#d4af37]">
            {creditCents > 0 ? `−${formatPrice(centsToDollars(creditCents))}` : formatPrice(0)}
          </span>
        </div>
        <div className="mt-3 flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>Due now</span>
          <span className="text-[#d4af37]">{formatPrice(payable)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#8f8c84]">
          Signed-in store credit and 20% off the total order amount are applied
          automatically. Prices charged by Stripe are taken
          from the catalogue, not from the browser cart. See the{" "}
          <Link href="/shipping-policy" className="text-[#d4af37]">
            Shipping Policy
          </Link>{" "}
          for dispatch notes.
        </p>
      </aside>
      </div>
    </div>
  );
}
