"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { prepareCartCheckout } from "@/app/actions/checkout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { WhopCheckoutElement } from "@/components/WhopCheckoutElement";
import { useAccount } from "@/lib/account";
import { defaultAddress, formatAddress, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import { quoteForDisplay } from "@/lib/cart-quote";
import type { ShippingAddressInput } from "@/lib/shipping";
import { checkoutTotals } from "@/lib/promo";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

type PaymentMethod = "card" | "bank_transfer";

type CardSession = {
  orderId: string;
  planId: string;
  sessionId: string;
  environment: "sandbox" | "production";
  returnUrl: string;
  totalCents: number;
};

type BankOrder = {
  orderId: string;
  totalCents: number;
  accountName: string | null;
  bsb: string | null;
  accountNumber: string | null;
};

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
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [mountKey, setMountKey] = useState(0);
  const [cardSession, setCardSession] = useState<CardSession | null>(null);
  const [bankOrder, setBankOrder] = useState<BankOrder | null>(null);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then((data: { configured?: boolean }) => {
        setConfigured(Boolean(data.configured));
      })
      .catch(() => {
        setConfigured(false);
      });
  }, []);

  const returnedError = useSyncExternalStore(
    () => () => {},
    () =>
      new URLSearchParams(window.location.search).get("status") === "error"
        ? "The card payment did not complete. You can try the card again, including 3D Secure."
        : null,
    () => null,
  );
  const visibleError = error ?? returnedError;

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const fallbackTotals = checkoutTotals({ items, promo });
  const quote = quoteForDisplay(items, promo?.code ?? null);
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const catalogCents = quote?.subtotalCents ?? fallbackTotals.catalogCents;
  const volumeDiscountCents = quote?.volumeDiscountCents ?? 0;
  const promoDiscountCents = quote?.promoDiscountCents ?? fallbackTotals.discountCents;
  const payable = centsToDollars(quote?.totalCents ?? fallbackTotals.discountedCents);

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
  const cardBlocked = paymentMethod === "card" && configured !== true;

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
              Store credit on the account page is not deducted from the charge.
            </p>
            <Link href="/account?next=/checkout" className="btn mt-4">
              Sign in or create account
            </Link>
          </aside>
        )}

        {!cardSession && !bankOrder ? (
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
              if (paymentMethod === "card" && configured !== true) {
                setError("Card checkout is not configured.");
                return;
              }
              setSubmitting(true);
              prepareCartCheckout({
                items: cartItems,
                email,
                firstName,
                lastName,
                shipping,
                promoCode: promo?.code ?? null,
                ageConfirmed: true,
                researchUse: true,
                paymentMethod,
              })
                .then((prepared) => {
                  if (prepared.method === "bank_transfer") {
                    setBankOrder({
                      orderId: prepared.orderId,
                      totalCents: prepared.totalCents,
                      accountName: prepared.accountName,
                      bsb: prepared.bsb,
                      accountNumber: prepared.accountNumber,
                    });
                    return;
                  }
                  setCardSession({
                    orderId: prepared.orderId,
                    planId: prepared.planId,
                    sessionId: prepared.sessionId,
                    environment: prepared.environment,
                    returnUrl: prepared.returnUrl,
                    totalCents: prepared.totalCents,
                  });
                  setMountKey(1);
                })
                .catch((reason: unknown) => {
                  setError(reason instanceof Error ? reason.message : "Checkout failed");
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
                Payment
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
                      Pay in AUD with Whop. The card form stays on this page.
                      3D Secure and other bank checks open inside the form.
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
                    <span className="block font-medium text-white">Bank transfer</span>
                    <span className="text-[#8f8c84]">
                      Place the order as pending and pay by bank transfer using the order ID as the reference.
                    </span>
                  </span>
                </label>
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
            {visibleError && (
              <p className="text-sm leading-6 text-[#d4af37]" role="alert">
                {visibleError}
              </p>
            )}
            {paymentMethod === "card" && configured === false && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Card checkout is not configured. Add{" "}
                <code className="text-[#d4af37]">WHOP_API_KEY</code>,{" "}
                <code className="text-[#d4af37]">WHOP_COMPANY_ID</code>, and{" "}
                <code className="text-[#d4af37]">WHOP_WEBHOOK_SECRET</code>.
                Sandbox mode is the default until <code className="text-[#d4af37]">WHOP_ENV=production</code>.
              </p>
            )}
            <button type="submit" className="btn" disabled={submitting || cardBlocked}>
              {submitting
                ? "Preparing…"
                : paymentMethod === "card"
                  ? "Continue to card payment"
                  : "Place bank transfer order"}
            </button>
          </form>
        ) : cardSession ? (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Paying {formatPrice(cardSession.totalCents / 100)} AUD as {email}.
              Card details stay in the Whop form
              {cardSession.environment === "sandbox" ? " (sandbox)." : "."}
              {" "}
              If 3D Secure or another bank step sends you away, you return to the
              order page. A declined payment loads this form again.
            </p>
            {visibleError && (
              <p className="text-sm leading-6 text-[#d4af37]" role="alert">
                {visibleError}
              </p>
            )}
            <div className="surface overflow-hidden p-3">
              <WhopCheckoutElement
                planId={cardSession.planId}
                sessionId={cardSession.sessionId}
                returnUrl={cardSession.returnUrl}
                environment={cardSession.environment}
                email={email}
                mountKey={mountKey}
                onPaymentError={(message) => {
                  setError(message);
                  setMountKey((current) => current + 1);
                }}
              />
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setCardSession(null);
                setError(null);
              }}
            >
              Edit details
            </button>
          </div>
        ) : bankOrder ? (
          <div className="space-y-4">
            <p className="font-medium text-white">Bank transfer</p>
            <p className="text-sm leading-6 text-[#8f8c84]">
              Order {bankOrder.orderId} is pending. Transfer{" "}
              {formatPrice(bankOrder.totalCents / 100)} AUD and use the order ID as the reference.
            </p>
            {bankOrder.accountName && bankOrder.bsb && bankOrder.accountNumber && (
              <p className="text-sm leading-7 text-[#8f8c84]">
                {bankOrder.accountName} · BSB {bankOrder.bsb} · {bankOrder.accountNumber}
              </p>
            )}
            <Link
              href={`/checkout/success?order_id=${encodeURIComponent(bankOrder.orderId)}`}
              className="btn"
            >
              View order
            </Link>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setBankOrder(null);
                setError(null);
              }}
            >
              Edit details
            </button>
          </div>
        ) : null}
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
          <span className="text-[#d4af37]">{formatPrice(centsToDollars(catalogCents))}</span>
        </div>
        <PromoCodeForm id="summary-checkout-code" />
        {volumeDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>10% off orders $200+</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(volumeDiscountCents))}
            </span>
          </div>
        )}
        {promoDiscountCents > 0 && (
          <div className="mb-3 flex justify-between text-sm">
            <span>{promo?.percentOff ?? quote?.promoPercentOff}% off total</span>
            <span className="text-[#d4af37]">
              −{formatPrice(centsToDollars(promoDiscountCents))}
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
            credit. It is not deducted from the charge.
          </p>
        )}
        <div className="mt-3 flex justify-between border-t border-[rgba(212,175,55,0.16)] pt-4">
          <span>Due now</span>
          <span className="text-[#d4af37]">{formatPrice(payable)}</span>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#8f8c84]">
          Store credit saved in this browser is not deducted from the charge.
          Orders of $200 or more receive 10% off before a coupon. The amount
          charged is taken from the catalogue on the server, not from the browser
          cart. See the{" "}
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
