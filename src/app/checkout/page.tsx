"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { startWhopCardCheckout } from "@/app/actions/checkout";
import { CartCheckout } from "@/components/CartCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CartDiscountLines } from "@/components/CartDiscountLines";
import { ClearCartOnSuccess } from "@/components/ClearCartOnSuccess";
import { Field, SelectField } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { useAccount } from "@/lib/account";
import { AU_STATES, defaultAddress, formatAddress, isAuState, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { checkoutTotals } from "@/lib/promo-pricing";
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

type PayMethod = "card" | "bank_transfer";

type CheckoutMethods = {
  card: boolean;
  bankTransfer: boolean;
  environment: "sandbox" | "production";
};

type CardSession = {
  sessionId: string;
  planId: string;
  orderReference: string;
  environment: "sandbox" | "production";
  returnUrl: string;
};

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [methods, setMethods] = useState<CheckoutMethods | null>(null);
  const [method, setMethod] = useState<PayMethod>("card");
  const [ready, setReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [cardSession, setCardSession] = useState<CardSession | null>(null);
  const [cardMount, setCardMount] = useState(0);
  const [cardError, setCardError] = useState<string | null>(null);
  const [cardComplete, setCardComplete] = useState(false);
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
      .then((data: { card?: boolean; bankTransfer?: boolean; cardEnvironment?: string }) => {
        const card = Boolean(data.card);
        const bankTransfer = Boolean(data.bankTransfer);
        setMethods({
          card,
          bankTransfer,
          environment: data.cardEnvironment === "production" ? "production" : "sandbox",
        });
        if (!card && bankTransfer) setMethod("bank_transfer");
      })
      .catch(() => {
        setMethods({ card: false, bankTransfer: false, environment: "sandbox" });
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
  const totals = checkoutTotals({
    items,
    promo,
  });
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const payable = centsToDollars(totals.discountedCents);
  const methodAvailable = method === "card" ? Boolean(methods?.card) : Boolean(methods?.bankTransfer);

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

        {!ready && !cardSession ? (
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
              if (method === "bank_transfer") {
                setReady(true);
                return;
              }
              setStarting(true);
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
                  setCardError(null);
                  setCardComplete(false);
                  setCardSession({
                    sessionId: result.sessionId,
                    planId: result.planId,
                    orderReference: result.orderReference,
                    environment: result.environment,
                    returnUrl: result.returnUrl,
                  });
                })
                .catch(() => {
                  setError("The card processor did not respond. Nothing has been charged.");
                })
                .finally(() => {
                  setStarting(false);
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
                  This address is saved with the order before payment is taken.{" "}
                  <Link href="/account#addresses" className="text-[#d4af37]">
                    Edit addresses
                  </Link>
                </p>
              </fieldset>
            )}
            <fieldset>
              <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
                Payment
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
                      Pay on this page. Card details are collected by Whop, including any bank
                      authentication step.
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
                      The next screen shows the PayID address, the amount, and the reference to
                      quote in the transfer description.
                    </span>
                  </span>
                </label>
              </div>
            </fieldset>
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
            {methods && !methodAvailable && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                {method === "card" ? (
                  <>
                    Card checkout is not configured. Add{" "}
                    <code className="text-[#d4af37]">WHOP_API_KEY</code>,{" "}
                    <code className="text-[#d4af37]">WHOP_COMPANY_ID</code>, and{" "}
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
            <button type="submit" className="btn" disabled={!methodAvailable || starting}>
              {starting ? "Preparing card checkout" : method === "card" ? "Continue to card" : "Continue to payment"}
            </button>
          </form>
        ) : cardSession ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Paying as {email}. Order {cardSession.orderReference}. The amount is calculated on
              the server in AUD.
              {promo ? ` ${promo.percentOff}% off the total order amount is applied.` : ""}
            </p>
            {cardComplete ? (
              <div className="space-y-3" role="status">
                <ClearCartOnSuccess />
                <p className="text-sm leading-6 text-[#8f8c84]">
                  The card form accepted this payment. A confirmation email is sent when Whop
                  confirms the charge. If your bank asked you to approve it, that step is included.
                </p>
                <Link href={`/order/${cardSession.orderReference}`} className="btn">
                  View order
                </Link>
              </div>
            ) : (
              <div className="surface overflow-hidden p-3">
                {cardError && (
                  <p className="mb-3 text-sm leading-6 text-[#d4af37]" role="alert">
                    {cardError} Nothing has been marked paid until Whop confirms the charge.
                  </p>
                )}
                <WhopCheckoutElement
                  key={cardMount}
                  sessionId={cardSession.sessionId}
                  planId={cardSession.planId}
                  returnUrl={cardSession.returnUrl}
                  environment={cardSession.environment}
                  email={email}
                  onComplete={() => setCardComplete(true)}
                  onPaymentError={(paymentError) => {
                    setCardError(
                      paymentError.message?.trim() ||
                        "The card payment did not complete. You can try the card again.",
                    );
                  }}
                />
                {cardError && (
                  <button
                    type="button"
                    className="btn mt-3"
                    onClick={() => {
                      setCardError(null);
                      setCardMount((count) => count + 1);
                    }}
                  >
                    Try the card again
                  </button>
                )}
              </div>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCardSession(null);
                setCardError(null);
                setCardComplete(false);
              }}
            >
              Edit details
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Ordering as {email}. Payment instructions appear on the next screen.
              {promo ? ` ${promo.percentOff}% off the total order amount is applied.` : ""}
            </p>
            <div className="surface overflow-hidden p-3">
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
        <PromoCodeForm id="summary-checkout-code" />
        <CartDiscountLines
          volumeDiscountCents={totals.volumeDiscountCents}
          promoDiscountCents={totals.promoDiscountCents}
          promo={promo}
        />
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
          Orders of $200 or more take 10% off before a coupon. Store credit saved in this
          browser is not deducted. The amount charged is taken from the catalogue, not from
          the browser cart. See the{" "}
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
