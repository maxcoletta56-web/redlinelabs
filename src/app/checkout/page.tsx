"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import { CartCheckout } from "@/components/CartCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field, SelectField } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { useAccount } from "@/lib/account";
import { AU_STATES, defaultAddress, formatAddress, isAuState, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { cardChargeCents, checkoutTotals } from "@/lib/promo-pricing";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";
import type { CheckoutPaymentMethod } from "@/lib/validation";

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

type CardEmbed = {
  sessionId: string;
  planId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
};

type MethodStatus = {
  bank: boolean;
  card: boolean;
};

const METHOD_COPY = {
  bank_transfer: {
    intro:
      "Payment is by Australian bank transfer or PayID. The next screen shows the PayID address, the amount, and the reference to quote in the transfer description.",
    paying: "Ordering as",
    payingDetail: "Payment instructions appear on the next screen.",
    addressNote: "This address is saved with the order before payment instructions are shown.",
    creditNote: "It is not deducted from the bank transfer total.",
    summaryNote:
      "Store credit saved in this browser is not deducted from the bank transfer total. Apply a coupon for a percent off the total order amount. The amount owed is taken from the catalogue, not from the browser cart.",
    setup: (
      <>
        Bank transfer checkout is not configured. Add{" "}
        <code className="text-[#d4af37]">PAYID_ADDRESS</code>,{" "}
        <code className="text-[#d4af37]">PAYID_ACCOUNT_NAME</code>, and{" "}
        <code className="text-[#d4af37]">DATABASE_URL</code>.
      </>
    ),
  },
  card: {
    intro:
      "The card form stays on this page. Whop collects the card. Orders of $200 or more take 10% off before any coupon. 3D Secure may ask you to confirm with your bank, then returns here.",
    paying: "Paying as",
    payingDetail: "Card details are collected below. The charge uses the catalogue total.",
    addressNote: "This address is saved with the order before the card form is shown.",
    creditNote: "It is not deducted from the card charge.",
    summaryNote:
      "Store credit saved in this browser is not deducted from the card charge. Card orders of $200 or more take 10% off, then any coupon applies to what remains. Prices charged are taken from the catalogue, not from the browser cart.",
    setup: (
      <>
        Card checkout is not configured. Add the server-only{" "}
        <code className="text-[#d4af37]">WHOP_API_KEY</code>,{" "}
        <code className="text-[#d4af37]">WHOP_WEBHOOK_SECRET</code>,{" "}
        <code className="text-[#d4af37]">WHOP_COMPANY_ID</code>, and{" "}
        <code className="text-[#d4af37]">DATABASE_URL</code>. Sandbox is the default.
      </>
    ),
  },
} as const;

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [methods, setMethods] = useState<MethodStatus | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<CheckoutPaymentMethod>("card");
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [embed, setEmbed] = useState<CardEmbed | null>(null);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");
  const [shippingOverrides, setShippingOverrides] = useState<ShippingDraft | null>(null);

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then(
        (data: {
          bankTransfer?: { configured?: boolean };
          card?: { configured?: boolean };
        }) => {
          const bank = Boolean(data.bankTransfer?.configured);
          const card = Boolean(data.card?.configured);
          setMethods({ bank, card });
          setPaymentMethod(card || !bank ? "card" : "bank_transfer");
        },
      )
      .catch(() => {
        setMethods({ bank: false, card: false });
      });
  }, []);

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const savedShipping = selectedAddress ? draftFromSaved(selectedAddress) : EMPTY_SHIPPING;
  const shippingDraft = shippingOverrides ?? savedShipping;
  const copy = METHOD_COPY[paymentMethod];
  const totals = checkoutTotals({
    items,
    promo,
  });
  const cardTotals = cardChargeCents(totals.catalogCents, promo);
  const payingByCard = paymentMethod === "card";
  const volumeCents = payingByCard ? cardTotals.volumeDiscountCents : 0;
  const promoOffCents = payingByCard ? cardTotals.promoDiscountCents : totals.discountCents;
  const payableCents = payingByCard ? cardTotals.totalCents : totals.discountedCents;
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const payable = centsToDollars(payableCents);
  const selectedReady = paymentMethod === "card" ? methods?.card === true : methods?.bank === true;

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
              if (paymentMethod === "bank_transfer") {
                setEmbed(null);
                setReady(true);
                return;
              }
              setSubmitting(true);
              void startCartCheckoutSession({
                items: cartItems,
                email,
                firstName,
                lastName,
                shipping,
                promoCode: promo?.code ?? null,
                ageConfirmed: true,
                researchUse: true,
                paymentMethod: "card",
              })
                .then((result) => {
                  if (!result.ok || result.method !== "card") {
                    setError(result.ok ? "Card checkout could not be started." : result.error);
                    return;
                  }
                  setEmbed({
                    sessionId: result.sessionId,
                    planId: result.planId,
                    environment: result.environment,
                    returnUrl: result.returnUrl,
                  });
                  setReady(true);
                })
                .catch(() => {
                  setError("The card processor did not respond. Nothing has been charged.");
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
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                  />
                  <span>
                    <span className="block font-medium text-white">Card</span>
                    <span className="text-[#8f8c84]">
                      Pay on this page with Whop. Orders of $200 or more take 10% off.
                    </span>
                  </span>
                </label>
                <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1"
                    checked={paymentMethod === "bank_transfer"}
                    onChange={() => setPaymentMethod("bank_transfer")}
                  />
                  <span>
                    <span className="block font-medium text-white">Bank transfer or PayID</span>
                    <span className="text-[#8f8c84]">
                      Pay from an Australian account. Instructions follow on the next screen.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
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
            {methods && !selectedReady && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                {copy.setup}
              </p>
            )}
            <button type="submit" className="btn" disabled={methods === null || !selectedReady || submitting}>
              {submitting ? "Preparing card checkout" : "Continue to payment"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              {copy.paying} {email}. {copy.payingDetail}
              {volumeCents > 0 ? " 10% off orders of $200 or more is applied." : ""}
              {promoOffCents > 0 && promo
                ? ` ${promo.percentOff}% off the remaining total is applied.`
                : ""}
            </p>
            <div className="surface overflow-hidden p-3">
              {paymentMethod === "card" && embed ? (
                <WhopCheckoutElement
                  planId={embed.planId}
                  sessionId={embed.sessionId}
                  returnUrl={embed.returnUrl}
                  environment={embed.environment}
                  email={email}
                  shipping={shipping}
                />
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
                setEmbed(null);
                setReady(false);
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
          <span className="text-[#d4af37]">{formatPrice(centsToDollars(totals.catalogCents))}</span>
        </div>
        <PromoCodeForm id="summary-checkout-code" />
        {volumeCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>10% off orders of $200 or more</span>
            <span className="text-[#d4af37]">−{formatPrice(centsToDollars(volumeCents))}</span>
          </div>
        )}
        {promoOffCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{promo?.percentOff}% off {payingByCard && volumeCents > 0 ? "remaining total" : "total"}</span>
            <span className="text-[#d4af37]">−{formatPrice(centsToDollars(promoOffCents))}</span>
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
      </aside>
      </div>
    </div>
  );
}
