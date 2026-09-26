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
import { quoteCart } from "@/lib/cart-quote";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/shipping";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

const EMBED_STORAGE_KEY = "rl-whop-embed";

type Prepared = Awaited<ReturnType<typeof prepareCartCheckout>>;

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

function readEmbed(raw: string | null): Extract<Prepared, { method: "card" }> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Extract<Prepared, { method: "card" }>;
    if (!parsed?.planId || !parsed.sessionId || !parsed.returnUrl) return null;
    return parsed;
  } catch {
    return null;
  }
}

function subscribeToLocation() {
  return () => undefined;
}

function readCardReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("status") !== "error") return "";
  return sessionStorage.getItem(EMBED_STORAGE_KEY) ?? "missing";
}

export default function CheckoutPage() {
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer">("card");
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const [dismissedReturn, setDismissedReturn] = useState(false);
  const [mountKey, setMountKey] = useState(0);
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

  const cardReturn = useSyncExternalStore(subscribeToLocation, readCardReturn, () => "");
  const restoredCard = !dismissedReturn && cardReturn && cardReturn !== "missing" ? readEmbed(cardReturn) : null;
  const active = prepared ?? restoredCard;
  const returnError =
    !dismissedReturn && cardReturn
      ? restoredCard
        ? "3D Secure or the card issuer did not complete the payment. The card form has been reloaded so you can try again."
        : "The card payment did not finish. Start the secure card form again."
      : null;

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);

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
  const quoteResult = useMemo(() => {
    if (cartItems.length === 0) return null;
    try {
      return { ok: true as const, quote: quoteCart(cartItems, promo?.code) };
    } catch (reason) {
      return {
        ok: false as const,
        message: reason instanceof Error ? reason.message : "Cart is invalid",
      };
    }
  }, [cartItems, promo]);

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

  const quote = quoteResult?.ok ? quoteResult.quote : null;
  const payable = quote ? centsToDollars(quote.totalCents) : 0;
  const browserCreditCents = user?.storeCreditCents ?? 0;

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

        {!active ? (
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
              if (!quoteResult?.ok) {
                setError(quoteResult?.message ?? "Cart is invalid");
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
                .then((result) => {
                  if (result.method === "card") {
                    sessionStorage.setItem(EMBED_STORAGE_KEY, JSON.stringify(result));
                  }
                  setPrepared(result);
                  setMountKey((key) => key + 1);
                })
                .catch((reason: unknown) => {
                  setError(reason instanceof Error ? reason.message : "Checkout failed");
                })
                .finally(() => setSubmitting(false));
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
                    checked={paymentMethod === "card"}
                    onChange={() => setPaymentMethod("card")}
                  />
                  <span>
                    <span className="block font-medium text-white">Card</span>
                    <span className="text-[#8f8c84]">
                      Pay on this page with Whop. Card numbers stay in the secure checkout element, including 3D Secure.
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
            {(error || returnError) && (
              <p className="text-sm leading-6 text-[#d4af37]" role="alert">
                {error || returnError}
              </p>
            )}
            {paymentMethod === "card" && configured === false && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Card checkout is not configured. Add{" "}
                <code className="text-[#d4af37]">WHOP_API_KEY</code> and{" "}
                <code className="text-[#d4af37]">WHOP_COMPANY_ID</code>. Sandbox mode is the default.
              </p>
            )}
            <button
              type="submit"
              className="btn"
              disabled={submitting || !quote || (paymentMethod === "card" && configured !== true)}
            >
              {submitting ? "Preparing…" : paymentMethod === "card" ? "Continue to card payment" : "Place bank transfer order"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Order {active.orderId} for {active.email}. Amount due{" "}
              {formatPrice(active.totalCents / 100)} AUD, calculated on the server.
            </p>
            {active.method === "card" ? (
              <div className="surface overflow-hidden p-3">
                <WhopCheckoutElement
                  planId={active.planId}
                  sessionId={active.sessionId}
                  returnUrl={active.returnUrl}
                  environment={active.environment}
                  email={active.email}
                  mountKey={restoredCard && !prepared ? 1 : mountKey}
                  onPaymentError={(message) => {
                    setError(message);
                    setMountKey((key) => key + 1);
                  }}
                />
              </div>
            ) : (
              <div className="surface p-5 text-sm leading-6 text-[#8f8c84]">
                <p className="font-medium text-white">Bank transfer</p>
                <p className="mt-2">
                  This order is saved as pending. Transfer {formatPrice(active.totalCents / 100)} AUD
                  and use <span className="text-[#d4af37]">{active.orderId}</span> as the payment reference.
                </p>
                {active.accountName && active.bsb && active.accountNumber ? (
                  <dl className="mt-4 space-y-1">
                    <div className="flex justify-between gap-4">
                      <dt>Account name</dt>
                      <dd className="text-white">{active.accountName}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>BSB</dt>
                      <dd className="text-white">{active.bsb}</dd>
                    </div>
                    <div className="flex justify-between gap-4">
                      <dt>Account number</dt>
                      <dd className="text-white">{active.accountNumber}</dd>
                    </div>
                  </dl>
                ) : (
                  <p className="mt-3">
                    Account details are confirmed by email from the registered company. Send the remittance advice to{" "}
                    <a className="text-[#d4af37]" href="mailto:redlinelabsltd@pm.me">
                      redlinelabsltd@pm.me
                    </a>{" "}
                    with this order ID.
                  </p>
                )}
              </div>
            )}
            {(error || returnError) && (
              <p className="text-sm leading-6 text-[#d4af37]" role="alert">
                {error || returnError}
              </p>
            )}
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setPrepared(null);
                setDismissedReturn(true);
                setError(null);
              }}
            >
              Edit details
            </button>
          </div>
        )}
      </div>
      <aside className="surface order-1 h-fit p-6 lg:order-2">
        <h2 className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase">Summary</h2>
        {quote ? (
          <>
            <ul className="mb-4 space-y-3 text-sm">
              {quote.lines.map((item) => (
                <li key={`${item.slug}-${item.option}`} className="flex justify-between gap-4">
                  <span>
                    {item.name}
                    {item.option ? ` (${optionLabel(item, item.option)})` : ""} × {item.qty}
                  </span>
                  <span className="text-[#d4af37]">
                    {formatPrice((item.unitAmountCents * item.qty) / 100)}
                  </span>
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
                <span>{quote.promoPercentOff}% off total</span>
                <span className="text-[#d4af37]">
                  −{formatPrice(centsToDollars(quote.promoDiscountCents))}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="mb-4 text-sm text-[#d4af37]" role="alert">
            {quoteResult && !quoteResult.ok ? quoteResult.message : "Cart is invalid"}
          </p>
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
          Orders of $200 or more receive 10% off the catalogue subtotal. Store credit
          saved in this browser is not deducted. Prices charged are taken from the
          catalogue, not from the browser cart. See the{" "}
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
