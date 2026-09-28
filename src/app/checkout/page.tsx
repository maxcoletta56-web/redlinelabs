"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import { CartCheckout } from "@/components/CartCheckout";
import { WhopCardCheckout } from "@/components/WhopCardCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import { defaultAddress, formatAddress, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { quoteDisplayedCart } from "@/lib/order-quote";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";
import { usePromo } from "@/lib/promo-state";
import type { WhopEmbeddedCheckout } from "@/lib/whop-session";

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

type PaymentMethod = "card" | "bank_transfer";

type CheckoutAvailability = {
  bankTransfer: boolean;
  card: boolean;
  environment: "sandbox" | "production";
};

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<CheckoutAvailability | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cardCheckout, setCardCheckout] = useState<WhopEmbeddedCheckout | null>(null);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then((data: CheckoutAvailability) => {
        const next = {
          bankTransfer: Boolean(data.bankTransfer),
          card: Boolean(data.card),
          environment: data.environment === "production" ? "production" : "sandbox",
        } as const;
        setAvailability(next);
        setMethod(next.card ? "card" : "bank_transfer");
      })
      .catch(() => {
        setAvailability({ bankTransfer: false, card: false, environment: "sandbox" });
      });
  }, []);

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const quote = quoteDisplayedCart(items, promo);
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const payable = centsToDollars(quote.totalCents);
  const selectedReady =
    method === "card" ? availability?.card === true : availability?.bankTransfer === true;

  const cartItems = useMemo(
    () =>
      items.map((item) => ({
        slug: item.slug,
        option: item.option,
        qty: item.qty,
      })),
    [items],
  );
  const shipping = useMemo(
    () => (selectedAddress ? shippingFromAddress(selectedAddress) : null),
    [selectedAddress],
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
              Sign in to keep order history and saved addresses in this browser.
              Store credit on the account page is not deducted from the order total.
            </p>
            <Link href="/account?next=/checkout" className="btn mt-4">
              Sign in or create account
            </Link>
          </aside>
        )}

        {!ready && !cardCheckout ? (
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
              if (method === "bank_transfer") {
                setReady(true);
                return;
              }
              setSubmitting(true);
              void startWhopCardCheckout({
                items: cartItems,
                email,
                firstName,
                lastName,
                shipping,
                promoCode: promo?.code ?? null,
                ageConfirmed: true,
                researchUse: true,
              })
                .then((result) => {
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setCardCheckout(result.checkout);
                })
                .catch(() => {
                  setError("The card checkout could not be started. Nothing has been charged.");
                })
                .finally(() => {
                  setSubmitting(false);
                });
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
                  This address is saved with the order before payment.{" "}
                  <Link href="/account#addresses" className="text-[#d4af37]">
                    Edit addresses
                  </Link>
                </p>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                Payment method
              </legend>
              <div className="space-y-2">
                <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1"
                    checked={method === "card"}
                    onChange={() => setMethod("card")}
                  />
                  <span>
                    <span className="block font-medium text-white">Card</span>
                    <span className="text-[#8f8c84]">
                      Pay on this page. Whop collects the card. 3D Secure opens here when the
                      bank asks for it.
                    </span>
                  </span>
                </label>
                <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1"
                    checked={method === "bank_transfer"}
                    onChange={() => setMethod("bank_transfer")}
                  />
                  <span>
                    <span className="block font-medium text-white">Bank transfer or PayID</span>
                    <span className="text-[#8f8c84]">
                      The next screen shows the PayID, the amount, and the reference to quote.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
            <p className="text-sm leading-6 text-[#8f8c84]">
              Orders of $200 or more include 10% off before any coupon. The amount charged is
              taken from the catalogue.
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
            {availability && !selectedReady && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                {method === "card" ? (
                  <>
                    Card checkout is not configured. Add{" "}
                    <code className="text-[#d4af37]">WHOP_API_KEY</code>,{" "}
                    <code className="text-[#d4af37]">WHOP_COMPANY_ID</code>,{" "}
                    <code className="text-[#d4af37]">WHOP_WEBHOOK_SECRET</code>, and{" "}
                    <code className="text-[#d4af37]">DATABASE_URL</code>.
                  </>
                ) : (
                  <>
                    Bank transfer checkout is not configured. Add{" "}
                    <code className="text-[#d4af37]">PAYID_ADDRESS</code>,{" "}
                    <code className="text-[#d4af37]">PAYID_ACCOUNT_NAME</code>, and{" "}
                    <code className="text-[#d4af37]">DATABASE_URL</code>.
                  </>
                )}
              </p>
            )}
            <button type="submit" className="btn" disabled={!selectedReady || submitting}>
              {submitting ? "Starting card checkout" : "Continue to payment"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              {method === "card" ? "Paying" : "Ordering"} as {email}.{" "}
              {method === "card"
                ? "Card details stay in the Whop checkout on this page."
                : "Payment instructions appear on the next screen."}
              {quote.volumeDiscountCents > 0 ? " 10% off this order is included." : ""}
              {promo ? ` ${promo.percentOff}% off the remaining total is applied.` : ""}
            </p>
            <div className="surface overflow-hidden p-3">
              {cardCheckout ? (
                <WhopCardCheckout checkout={cardCheckout} email={email} />
              ) : (
                <CartCheckout
                  items={cartItems}
                  email={email}
                  firstName={firstName}
                  lastName={lastName}
                  shipping={shipping}
                  promoCode={promo?.code ?? null}
                  ageConfirmed
                  researchUse
                />
              )}
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setReady(false);
                setCardCheckout(null);
              }}
            >
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
          <span className="text-[#d4af37]">{formatPrice(centsToDollars(quote.subtotalCents))}</span>
        </div>
        <PromoCodeForm id="summary-checkout-code" />
        {quote.volumeDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>10% off orders $200+</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(quote.volumeDiscountCents))}
            </span>
          </div>
        )}
        {quote.promoDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{promo?.percentOff}% off total</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(quote.promoDiscountCents))}
            </span>
          </div>
        )}
        <div className="mt-3 flex justify-between text-sm">
          <span>Store credit</span>
          <span className="text-[#d4af37]">{formatPrice(0)}</span>
        </div>
        {browserCreditCents > 0 && (
          <p className="mt-2 text-xs leading-5 text-[#8f8c84]">
            This browser shows {formatPrice(centsToDollars(browserCreditCents))} saved
            credit. It is not deducted from the amount due.
          </p>
        )}
        <div className="mt-3 flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>Due now</span>
          <span className="text-[#d4af37]">{formatPrice(payable)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#8f8c84]">
          Store credit saved in this browser is not deducted. Orders of $200 or more include
          10% off before any coupon. The amount charged is taken from the catalogue, not from
          the browser cart. See the{" "}
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
