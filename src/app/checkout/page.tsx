"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { startCartCheckoutSession } from "@/app/actions/checkout";
import { WhopCardCheckout } from "@/components/WhopCardCheckout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import { PromoCodeForm } from "@/components/PromoCodeForm";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import { defaultAddress, formatAddress, type SavedAddress } from "@/lib/account-data";
import { useCart } from "@/lib/cart";
import type { ShippingAddressInput } from "@/lib/checkout-session";
import { resolveCartLines } from "@/lib/order";
import { checkoutTotals } from "@/lib/promo";
import { usePromo } from "@/lib/promo-state";
import { formatPrice, optionLabel } from "@/lib/products";
import { centsToDollars } from "@/lib/store-credit";

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
  const router = useRouter();
  const { items } = useCart();
  const { promo } = usePromo();
  const { user, hydrated } = useAccount();
  const [error, setError] = useState<string | null>(null);
  const [cardReady, setCardReady] = useState<boolean | null>(null);
  const [bankReady, setBankReady] = useState<boolean | null>(null);
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "bank_transfer">("card");
  const [submitting, setSubmitting] = useState(false);
  const [started, setStarted] = useState<Awaited<ReturnType<typeof startCartCheckoutSession>> | null>(null);
  const [customer, setCustomer] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
  }>({});
  const [addressId, setAddressId] = useState<string>("");

  useEffect(() => {
    fetch("/api/checkout")
      .then((res) => res.json())
      .then((data: { card?: boolean; bank?: boolean; environment?: "sandbox" | "production" }) => {
        setCardReady(Boolean(data.card));
        setBankReady(Boolean(data.bank));
        if (data.environment === "production" || data.environment === "sandbox") {
          setEnvironment(data.environment);
        }
        if (!data.card && data.bank) setPaymentMethod("bank_transfer");
      })
      .catch(() => {
        setCardReady(false);
        setBankReady(false);
      });
  }, []);

  const firstName = customer.firstName ?? user?.firstName ?? "";
  const lastName = customer.lastName ?? user?.lastName ?? "";
  const email = customer.email ?? user?.email ?? "";
  const selectedAddress =
    user?.addresses.find((address) => address.id === addressId) ??
    (user ? defaultAddress(user) : null);
  const pricedLines = useMemo(() => {
    if (items.length === 0) return [];
    try {
      return resolveCartLines(
        items.map((item) => ({ slug: item.slug, option: item.option, qty: item.qty })),
      );
    } catch {
      return null;
    }
  }, [items]);
  const totals = checkoutTotals({
    items: (pricedLines ?? []).map((line) => ({
      price: line.unitAmountCents / 100,
      qty: line.qty,
    })),
    promo,
  });
  const browserCreditCents = user?.storeCreditCents ?? 0;
  const payable = centsToDollars(totals.discountedCents);

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
              Store credit on the account page is not deducted from the card charge.
            </p>
            <Link href="/account?next=/checkout" className="btn mt-4">
              Sign in or create account
            </Link>
          </aside>
        )}

        {!started ? (
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
              setSubmitting(true);
              startCartCheckoutSession({
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
                .then((result) => setStarted(result))
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
                      Pay in AUD with Whop on this page. Card numbers stay in the Whop checkout element.
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
                      Place the order as pending and pay the server-calculated AUD amount by transfer.
                    </span>
                  </span>
                </label>
              </div>
              {environment === "sandbox" && paymentMethod === "card" && (
                <p className="mt-2 text-xs leading-5 text-[#8f8c84]">
                  Sandbox mode. A successful test charge uses card 4242 4242 4242 4242.
                  3D Secure uses 5385 3083 6013 5181 and the password Checkout1!.
                </p>
              )}
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
            {paymentMethod === "card" && cardReady === false && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Card checkout is not configured. Add WHOP_API_KEY, WHOP_COMPANY_ID, and DATABASE_URL.
              </p>
            )}
            {paymentMethod === "bank_transfer" && bankReady === false && (
              <p className="text-sm leading-6 text-[#d4af37]" role="status">
                Bank transfer needs order storage. Add DATABASE_URL.
              </p>
            )}
            <button
              type="submit"
              className="btn"
              disabled={
                submitting ||
                (paymentMethod === "card" ? cardReady !== true : bankReady !== true)
              }
            >
              {submitting ? "Preparing payment…" : paymentMethod === "card" ? "Continue to card" : "Place bank transfer"}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-6 text-[#8f8c84]">
              Paying as {email}. The amount is calculated on the server
              {totals.volumeDiscountCents > 0 ? ", including 10% off this order of $200 or more" : ""}.
            </p>
            {started.method === "card" && started.sessionId ? (
              <div className="surface overflow-hidden p-3">
                <WhopCardCheckout
                  sessionId={started.sessionId}
                  environment={started.environment}
                  returnUrl={started.returnUrl}
                  email={email}
                  onComplete={() => {
                    router.push(`/checkout/success?order=${started.orderId}`);
                  }}
                  onPaymentError={() => {
                    /* The element shows the message and can be remounted. */
                  }}
                />
              </div>
            ) : (
              <div className="surface space-y-3 p-5 text-sm leading-6 text-[#8f8c84]">
                <p className="font-medium text-white">Bank transfer</p>
                <p>
                  Order {started.orderId} is pending. Transfer{" "}
                  <span className="text-[#d4af37]">{formatPrice(started.totalCents / 100)}</span>{" "}
                  AUD and use that order reference.
                </p>
                {started.bankDetails ? (
                  <p>
                    {started.bankDetails.accountName}
                    <br />
                    BSB {started.bankDetails.bsb}
                    <br />
                    Account {started.bankDetails.accountNumber}
                  </p>
                ) : (
                  <p>
                    Email redlinelabsltd@pm.me with the order reference if you need the account name,
                    BSB, and account number confirmed.
                  </p>
                )}
              </div>
            )}
            <button type="button" className="btn-ghost" onClick={() => setStarted(null)}>
              Edit details
            </button>
          </div>
        )}
      </div>
      <aside className="surface order-1 h-fit p-6 lg:order-2">
        <h2 className="mb-4 text-[13px] font-semibold tracking-[0.12em] uppercase">Summary</h2>
        <ul className="mb-4 space-y-3 text-sm">
          {(pricedLines ?? []).map((line) => (
            <li key={`${line.slug}-${line.option}`} className="flex justify-between gap-4">
              <span>
                {line.name}
                {line.option ? ` (${optionLabel(line, line.option)})` : ""} × {line.qty}
              </span>
              <span className="text-[#d4af37]">
                {formatPrice((line.unitAmountCents * line.qty) / 100)}
              </span>
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
          Store credit saved in this browser is not deducted from the charge.
          Orders of $200 or more take 10% off the catalogue total. Prices are
          taken from the catalogue on the server, not from the browser cart. See the{" "}
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
