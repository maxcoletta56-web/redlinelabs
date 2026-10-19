"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CartCheckout } from "@/components/CartCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field, SelectField } from "@/components/Field";
import {
  PaymentMethodChoice,
  useCheckoutAvailability,
  useSelectedPaymentMethod,
} from "@/components/PaymentMethodChoice";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import { AU_STATES, defaultAddress, formatAddress, isAuState, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { isMemberSpecial, memberUnitCents } from "@/lib/membership";
import { checkoutTotals, priceCardOrderCents } from "@/lib/promo-pricing";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

const AU_POSTCODE = /^\d{4}$/;

type ShippingDraft = {
  line1: string;
  line2: string;
  city: string;
  state: string;
  postcode: string;
};

const EMPTY_SHIPPING: ShippingDraft = {
  line1: "",
  line2: "",
  city: "",
  state: "",
  postcode: "",
};

function draftFromSaved(address: SavedAddress): ShippingDraft {
  return {
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postcode: address.postcode,
  };
}

function shippingDraftError(draft: ShippingDraft) {
  if (!draft.line1.trim()) return "Address line 1 is required";
  if (!draft.city.trim()) return "Suburb or city is required";
  if (!isAuState(draft.state.trim())) return "Select an Australian state or territory";
  if (!AU_POSTCODE.test(draft.postcode.trim())) return "Enter a 4-digit Australian postcode";
  return null;
}

const PROVIDER_COPY = {
  bank_transfer: {
    intro:
      "Payment is by Australian bank transfer or PayID. The next screen shows the PayID address, the amount, and the reference to quote in the transfer description.",
    paying: "Ordering as",
    payingDetail: "Payment instructions appear on the next screen.",
    addressNote: "This address is saved with the order before payment instructions are shown.",
    creditNote: "It is not deducted from the bank transfer total.",
    summaryNote:
      "Store credit saved in this browser is not deducted from the bank transfer total. Apply a coupon for 20% off the total order amount. The amount owed is taken from the catalogue, not from the browser cart.",
    setup: (
      <>
        Bank transfer checkout is not configured. Add{" "}
        <code className="text-[#d4af37]">PAYID_ADDRESS</code>,{" "}
        <code className="text-[#d4af37]">PAYID_ACCOUNT_NAME</code>, and{" "}
        <code className="text-[#d4af37]">DATABASE_URL</code>.
      </>
    ),
  },
  whop: {
    intro:
      "Pay by card in the form on this page. Card details stay with Whop. Orders of $200 or more receive 10% off before any coupon. The amount is calculated on the server.",
    paying: "Paying as",
    payingDetail: "Enter the card in the secure form below. You stay on this page.",
    addressNote: "This address is saved with the order before the card form opens.",
    creditNote: "It is not deducted from the card charge.",
    summaryNote:
      "Orders of $200 or more receive 10% off the catalogue subtotal before any coupon. Store credit saved in this browser is not deducted. The amount charged is taken from the catalogue, not from the browser cart.",
    setup: (
      <>
        Card checkout is not configured. Add <code className="text-[#d4af37]">WHOP_API_KEY</code>.
      </>
    ),
  },
  paypal: {
    intro:
      "Payment continues on PayPal card checkout. PayPal collects the card, and the charge is sent to the merchant account. You return here after payment.",
    paying: "Paying as",
    payingDetail: "Card details are handled by PayPal.",
    addressNote: "This address is saved with the order before PayPal takes payment.",
    creditNote: "It is not deducted from the PayPal charge.",
    summaryNote:
      "Store credit saved in this browser is not deducted from the PayPal charge. Apply a coupon for 20% off the total order amount. Prices charged are taken from the catalogue, not from the browser cart.",
    setup: (
      <>
        PayPal checkout is not configured. Add{" "}
        <code className="text-[#d4af37]">PAYPAL_CLIENT_ID</code> and{" "}
        <code className="text-[#d4af37]">PAYPAL_CLIENT_SECRET</code>. Production uses the live
        PayPal API.
      </>
    ),
  },
} as const;

export default function CheckoutPage() {
  const availability = useCheckoutAvailability();
  const { method, choose } = useSelectedPaymentMethod(availability.showChoice);
  const copy =
    PROVIDER_COPY[availability.showChoice ? method : availability.defaultMethod];
  const paymentMethod = availability.showChoice ? method : availability.defaultMethod;
  const configured = availability.ready ? availability.configured : null;
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [memberStatus, setMemberStatus] = useState({ email: "", active: false });
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");
  const [shippingOverrides, setShippingOverrides] = useState<ShippingDraft | null>(null);

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";

  useEffect(() => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes("@")) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      fetch("/api/club/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      })
        .then((response) => response.json())
        .then((body: { active?: boolean }) => {
          if (!cancelled) setMemberStatus({ email: trimmed, active: body.active === true });
        })
        .catch(() => {
          if (!cancelled) setMemberStatus({ email: trimmed, active: false });
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [email]);

  const memberActive = memberStatus.email === email.trim().toLowerCase() && memberStatus.active;

  const pricedItems = useMemo(() => {
    const now = new Date();
    return items.map((item) => {
      if (!memberActive || !isMemberSpecial(item.slug, now)) return item;
      return { ...item, price: memberUnitCents(Math.round(item.price * 100)) / 100 };
    });
  }, [items, memberActive]);
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const savedShipping = selectedAddress ? draftFromSaved(selectedAddress) : EMPTY_SHIPPING;
  const shippingDraft = shippingOverrides ?? savedShipping;
  const catalogue = checkoutTotals({ items, promo: null });
  const memberPriced = checkoutTotals({ items: pricedItems, promo: null });
  const memberSavingsCents = catalogue.catalogCents - memberPriced.catalogCents;
  const totals = checkoutTotals({
    items: pricedItems,
    promo,
  });
  const cardPricing = priceCardOrderCents(totals.catalogCents, promo);
  const payingByCard = paymentMethod === "whop";
  const dueCents = payingByCard ? cardPricing.totalCents : totals.discountedCents;
  const promoOffCents = payingByCard ? cardPricing.promoCents : totals.discountCents;
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const payable = centsToDollars(dueCents);
  const summaryItems = pricedItems;

  const cartItems = useMemo(
    () =>
      items.map((item) => ({
        slug: item.slug,
        option: item.option,
        qty: item.qty,
      })),
    [items],
  );
  const shipping = useMemo<ShippingAddressInput>(
    () => ({
      name: `${firstName} ${lastName}`.trim(),
      line1: shippingDraft.line1,
      line2: shippingDraft.line2.trim() || undefined,
      city: shippingDraft.city,
      state: shippingDraft.state,
      postal_code: shippingDraft.postcode,
      country: "AU",
    }),
    [
      firstName,
      lastName,
      shippingDraft.line1,
      shippingDraft.line2,
      shippingDraft.city,
      shippingDraft.state,
      shippingDraft.postcode,
    ],
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
              const addressError = shippingDraftError(shippingDraft);
              if (addressError) {
                setError(addressError);
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
                        onChange={() => {
                          setAddressId(address.id);
                          setShippingOverrides(null);
                        }}
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
                  {copy.addressNote}{" "}
                  <Link href="/account#addresses" className="text-[#d4af37]">
                    Edit addresses
                  </Link>
                </p>
              </fieldset>
            )}
            {availability.showChoice && (
              <PaymentMethodChoice value={method} onChange={choose} methods={availability.methods} />
            )}
            <p className="text-sm leading-6 text-[#8f8c84]">{copy.intro}</p>
            <fieldset className="space-y-4">
              <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                Shipping address
              </legend>
              <Field
                id="address-line1"
                label="Address line 1"
                name="line1"
                autoComplete="address-line1"
                value={shippingDraft.line1}
                onChange={(event) =>
                  setShippingOverrides((current) => ({
                    ...(current ?? savedShipping),
                    line1: event.target.value,
                  }))
                }
              />
              <Field
                id="address-line2"
                label="Address line 2"
                name="line2"
                autoComplete="address-line2"
                value={shippingDraft.line2}
                onChange={(event) =>
                  setShippingOverrides((current) => ({
                    ...(current ?? savedShipping),
                    line2: event.target.value,
                  }))
                }
              />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field
                  id="address-city"
                  label="Suburb / city"
                  name="city"
                  autoComplete="address-level2"
                  value={shippingDraft.city}
                  onChange={(event) =>
                    setShippingOverrides((current) => ({
                      ...(current ?? savedShipping),
                      city: event.target.value,
                    }))
                  }
                />
                <SelectField
                  id="address-state"
                  label="State"
                  name="state"
                  autoComplete="address-level1"
                  value={shippingDraft.state}
                  onChange={(event) =>
                    setShippingOverrides((current) => ({
                      ...(current ?? savedShipping),
                      state: event.target.value,
                    }))
                  }
                >
                  <option value="">Select</option>
                  {AU_STATES.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </SelectField>
                <Field
                  id="address-postcode"
                  label="Postcode"
                  name="postcode"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  value={shippingDraft.postcode}
                  onChange={(event) =>
                    setShippingOverrides((current) => ({
                      ...(current ?? savedShipping),
                      postcode: event.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                  Country
                </span>
                <p id="address-country" className="field">
                  Australia
                </p>
              </div>
            </fieldset>
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
                {PROVIDER_COPY[availability.setup ?? availability.defaultMethod].setup}
              </p>
            )}
            <button type="submit" className="btn" disabled={configured !== true}>
              Continue to payment
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              {copy.paying} {email}. {copy.payingDetail}
              {promo
                ? ` ${promo.percentOff}% off the total order amount is applied.`
                : ""}
            </p>
            <div className="surface overflow-hidden p-3">
              <CartCheckout
                items={cartItems}
                email={email}
                firstName={firstName}
                lastName={lastName}
                shipping={shipping}
                promoCode={promo?.code ?? null}
                paymentMethod={paymentMethod}
                ageConfirmed
                researchUse
              />
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
          {summaryItems.map((item) => (
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
        <PromoCodeForm id="summary-checkout-code" />
        {memberSavingsCents > 0 && (
          <p className="mb-3 text-sm text-[#8f8c84]">
            Member price is already in the subtotal —{" "}
            {formatPrice(centsToDollars(memberSavingsCents))} off the regular total.
          </p>
        )}
        {payingByCard && cardPricing.volumeCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>10% off orders $200+</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(cardPricing.volumeCents))}
            </span>
          </div>
        )}
        {promoOffCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{promo?.percentOff}% off total</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(promoOffCents))}
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
            credit. {copy.creditNote}
          </p>
        )}
        <div className="mt-3 flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>Due now</span>
          <span className="text-[#d4af37]">{formatPrice(payable)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#8f8c84]">
          {copy.summaryNote} See the{" "}
          <Link href="/shipping-policy" className="text-[#d4af37]">
            Shipping Policy
          </Link>{" "}
          for dispatch notes.
        </p>
        <Link href="/shop" className="btn-ghost mt-4 w-full">
          Continue shopping
        </Link>
      </aside>
      </div>
    </div>
  );
}
