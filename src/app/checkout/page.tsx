"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { startCartCheckoutSession, type CheckoutMethod, type CheckoutStart } from "@/app/actions/checkout";
import { BankTransferPending, CardCheckout, type CardCheckoutSession } from "@/components/CartCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field, SelectField } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import { AU_STATES, defaultAddress, formatAddress, isAuState, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { COMPANY_EMAIL } from "@/lib/company";
import { checkoutTotals } from "@/lib/promo-pricing";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";
import { withTimeout } from "@/lib/with-timeout";

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

const SUBMIT_TIMEOUT_MS = 25_000;

type CheckoutOptions = {
  bank: boolean;
  card: boolean;
  environment: "sandbox" | "production";
};

type PaymentPhase =
  | { status: "form" }
  | { status: "starting"; method: CheckoutMethod }
  | { status: "redirecting" }
  | { status: "card"; session: CardCheckoutSession }
  | { status: "error"; message: string };

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<CheckoutOptions | null>(null);
  const [method, setMethod] = useState<CheckoutMethod>("card");
  const [phase, setPhase] = useState<PaymentPhase>({ status: "form" });
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
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
      .then((data: {
        bankTransfer?: { configured?: boolean };
        card?: { configured?: boolean; environment?: string };
      }) => {
        const bank = Boolean(data.bankTransfer?.configured);
        const card = Boolean(data.card?.configured);
        const environment = data.card?.environment === "production" ? "production" : "sandbox";
        setOptions({ bank, card, environment });
        setMethod(card ? "card" : "bank_transfer");
      })
      .catch(() => {
        setOptions({ bank: false, card: false, environment: "sandbox" });
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
  const methodReady = options ? (method === "card" ? options.card : options.bank) : false;

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

  function setSubmittingLocked(locked: boolean) {
    submittingRef.current = locked;
    setSubmitting(locked);
  }

  function applyCheckoutResult(result: CheckoutStart) {
    if (!result.ok) {
      setSubmittingLocked(false);
      setPhase({ status: "error", message: result.error });
      return;
    }
    if (result.method === "card") {
      setPhase({
        status: "card",
        session: {
          sessionId: result.sessionId,
          planId: result.planId,
          environment: result.environment,
          returnUrl: result.returnUrl,
          reference: result.reference,
          totalCents: result.totalCents,
        },
      });
      return;
    }
    setPhase({ status: "redirecting" });
    window.location.assign(result.redirectUrl);
  }

  async function beginCheckout() {
    if (submittingRef.current) return;
    setSubmittingLocked(true);
    setError(null);
    setPhase({ status: "starting", method });
    try {
      const result = await withTimeout(
        startCartCheckoutSession({
          items: cartItems,
          email,
          firstName,
          lastName,
          shipping,
          promoCode: promo?.code ?? null,
          ageConfirmed: true,
          researchUse: true,
          method,
        }),
        SUBMIT_TIMEOUT_MS,
        "Checkout",
      );
      applyCheckoutResult(result);
    } catch (reason: unknown) {
      setSubmittingLocked(false);
      console.error("checkout submit failed", reason);
      setPhase({
        status: "error",
        message:
          reason instanceof Error && reason.name === "TimeoutError"
            ? "Checkout is taking longer than expected. Nothing has been charged."
            : "Checkout could not be started. Nothing has been charged.",
      });
    }
  }

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

        {phase.status === "form" ? (
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
              if (!methodReady) {
                setError("That payment method is not configured yet.");
                return;
              }
              setCustomer({
                firstName,
                lastName,
                email,
              });
              void beginCheckout();
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
                  This address is saved with the order.{" "}
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
                    disabled={options !== null && !options.card}
                    onChange={() => setMethod("card")}
                  />
                  <span>
                    <span className="block font-medium text-white">Card</span>
                    <span className="text-[#8f8c84]">
                      Pay on this page with Whop. 3D Secure and other bank checks stay in the
                      checkout when the card issuer asks for them.
                      {options?.environment === "sandbox" ? " Sandbox mode is on." : ""}
                    </span>
                  </span>
                </label>
                <label className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6">
                  <input
                    type="radio"
                    name="paymentMethod"
                    className="mt-1"
                    checked={method === "bank_transfer"}
                    disabled={options !== null && !options.bank}
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
            {options && !options.card && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Card checkout is not configured. Add WHOP_API_KEY, WHOP_WEBHOOK_SECRET,
                WHOP_COMPANY_ID, and DATABASE_URL.
              </p>
            )}
            {options && !options.bank && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Bank transfer checkout is not configured. Add PAYID_ADDRESS, PAYID_ACCOUNT_NAME,
                and DATABASE_URL.
              </p>
            )}
            <button type="submit" className="btn" disabled={!methodReady || submitting}>
              {method === "card" ? "Continue to card payment" : "Continue to bank transfer"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              {method === "card" ? "Paying as" : "Ordering as"} {email}.
              {promo ? ` ${promo.percentOff}% off the total order amount is applied.` : ""}
              {totals.volumeDiscountCents > 0 ? " 10% off orders of $200 or more is applied." : ""}
            </p>
            <div className="surface overflow-hidden p-3">
              {phase.status === "starting" && (
                <p className="text-sm leading-6 text-[#8f8c84]" role="status">
                  {phase.method === "card"
                    ? "Preparing the card checkout. Nothing has been charged yet."
                    : "Creating your order and payment instructions."}
                </p>
              )}
              {phase.status === "redirecting" && <BankTransferPending />}
              {phase.status === "card" && <CardCheckout session={phase.session} />}
              {phase.status === "error" && (
                <div className="space-y-3" role="alert">
                  <p className="text-sm leading-6 text-[#d4af37]">{phase.message}</p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      void beginCheckout();
                    }}
                  >
                    Try again
                  </button>
                  <p className="text-xs leading-6 text-[#8f8c84]">
                    Having trouble? Email{" "}
                    <a href={`mailto:${COMPANY_EMAIL}`} className="text-[#d4af37]">
                      {COMPANY_EMAIL}
                    </a>
                    .
                  </p>
                </div>
              )}
            </div>
            {phase.status !== "redirecting" && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setSubmittingLocked(false);
                  setPhase({ status: "form" });
                }}
              >
                Edit details
              </button>
            )}
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
        {totals.volumeDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>10% off orders of $200 or more</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(totals.volumeDiscountCents))}
            </span>
          </div>
        )}
        {totals.promoDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{promo?.percentOff}% off total</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(totals.promoDiscountCents))}
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
          Prices charged are taken from the catalogue, including 10% off orders of $200 or more.
          Store credit saved in this browser is not deducted. See the{" "}
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
