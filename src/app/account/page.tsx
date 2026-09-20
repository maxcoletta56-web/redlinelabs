"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddressForm } from "@/components/AddressForm";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Field } from "@/components/Field";
import {
  IconBell,
  IconCard,
  IconClock,
  IconPin,
} from "@/components/Icons";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { useAccount } from "@/lib/account";
import {
  auspostTrackingUrl,
  coaMailto,
  formatAddress,
  lineDisplayName,
  trackingMailto,
  type OrderRecord,
  type PublicAccount,
  type SavedAddress,
} from "@/lib/account-data";
import { centsToDollars } from "@/lib/store-credit";
import { formatPrice } from "@/lib/products";

const benefits = [
  {
    icon: IconClock,
    title: "Full history",
    text: "Every order, COA, and tracking number.",
  },
  {
    icon: IconCard,
    title: "Store credit",
    text: "Apply your store credit automatically at checkout.",
  },
  {
    icon: IconPin,
    title: "Saved addresses",
    text: "Auto-fill at checkout, edit any time.",
  },
  {
    icon: IconBell,
    title: "Stock alerts",
    text: "Get pinged when batches restock.",
  },
] as const;

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/account";
  }
  return value;
}

export default function AccountPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, hydrated, login, signup, logout } = useAccount();
  const next = safeNext(searchParams.get("next"));
  const [mode, setMode] = useState<"signup" | "login">(
    searchParams.get("mode") === "login" ? "login" : "signup",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!hydrated) {
    return (
      <div className="wrap py-16">
        <p className="kicker mb-3">Account</p>
        <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em]">Account</h1>
        <p className="mt-4 text-sm text-[#8f8c84]">Loading your profile…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="wrap py-16">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Account" }]} />
        <ResearchDisclaimer className="mb-10" />
        <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div>
            <p className="kicker mb-3">Account</p>
            <h1 className="mb-4 text-[2.15rem] font-semibold tracking-[-0.03em] text-white">
              Sign up to access your profile
            </h1>
            <p className="mb-8 max-w-xl text-[15px] leading-7 text-[#8f8c84]">
              An account is required to view full history, store credit, saved
              addresses, and stock alerts.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {benefits.map((item) => (
                <article key={item.title} className="surface p-5">
                  <div className="mb-3 text-[#d4af37]">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <h2 className="mb-2 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
                    {item.title}
                  </h2>
                  <p className="text-[14px] leading-6 text-[#8f8c84]">{item.text}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="surface p-6 sm:p-8">
            <div className="mb-6 flex gap-2" role="tablist" aria-label="Account access">
              <button
                type="button"
                role="tab"
                id="account-tab-signup"
                aria-controls="account-panel"
                aria-selected={mode === "signup"}
                className={`flex-1 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase ${
                  mode === "signup" ? "border-b-2 border-[#d4af37] text-[#d4af37]" : "text-[#8f8c84]"
                }`}
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
              >
                Create account
              </button>
              <button
                type="button"
                role="tab"
                id="account-tab-login"
                aria-controls="account-panel"
                aria-selected={mode === "login"}
                className={`flex-1 py-2 text-[11px] font-semibold tracking-[0.12em] uppercase ${
                  mode === "login" ? "border-b-2 border-[#d4af37] text-[#d4af37]" : "text-[#8f8c84]"
                }`}
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
              >
                Sign in
              </button>
            </div>
            <form
              id="account-panel"
              role="tabpanel"
              aria-labelledby={mode === "signup" ? "account-tab-signup" : "account-tab-login"}
              className="space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setError(null);
                setPending(true);
                const form = new FormData(event.currentTarget);
                try {
                  if (mode === "signup") {
                    if (form.get("ageConfirmed") !== "on") {
                      throw new Error("Confirm you are 18 years of age or older");
                    }
                    await signup({
                      firstName: String(form.get("firstName") ?? ""),
                      lastName: String(form.get("lastName") ?? ""),
                      email: String(form.get("email") ?? ""),
                      password: String(form.get("password") ?? ""),
                    });
                  } else {
                    await login(
                      String(form.get("email") ?? ""),
                      String(form.get("password") ?? ""),
                    );
                  }
                  router.replace(next);
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : "Could not continue");
                } finally {
                  setPending(false);
                }
              }}
            >
              {mode === "signup" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id="account-first" label="First name" name="firstName" required autoComplete="given-name" />
                  <Field id="account-last" label="Last name" name="lastName" required autoComplete="family-name" />
                </div>
              )}
              <Field
                id="account-email"
                label="Email"
                name="email"
                type="email"
                required
                autoComplete="email"
              />
              <Field
                id="account-password"
                label="Password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && (
                <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
                  <input type="checkbox" name="ageConfirmed" required className="mt-1" />
                  I confirm I am 18 years of age or older and will use this account for
                  laboratory research purchasing only.
                </label>
              )}
              {error && (
                <p className="text-sm text-[#d4af37]" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="btn w-full" disabled={pending}>
                {pending
                  ? "Please wait"
                  : mode === "signup"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AccountDashboard
      user={user}
      onSignOut={() => {
        logout();
        router.replace("/account");
      }}
    />
  );
}

function AccountDashboard({
  user,
  onSignOut,
}: {
  user: PublicAccount;
  onSignOut: () => void;
}) {
  const [editing, setEditing] = useState<SavedAddress | "new" | null>(null);
  const { saveAddress, deleteAddress, makeDefaultAddress, unwatchProduct } = useAccount();
  const stats = useMemo(
    () => [
      {
        icon: IconClock,
        title: "Full history",
        value: `${user.orders.length} order${user.orders.length === 1 ? "" : "s"}`,
        text: "Every order, COA, and tracking number.",
      },
      {
        icon: IconCard,
        title: "Store credit",
        value: formatPrice(centsToDollars(user.storeCreditCents)),
        text: "Apply your store credit automatically at checkout.",
      },
      {
        icon: IconPin,
        title: "Saved addresses",
        value: `${user.addresses.length} saved`,
        text: "Auto-fill at checkout, edit any time.",
      },
      {
        icon: IconBell,
        title: "Stock alerts",
        value: `${user.stockAlerts.length} watching`,
        text: "Get pinged when batches restock.",
      },
    ],
    [user],
  );

  return (
    <div className="wrap py-16">
      <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Account" }]} />
      <ResearchDisclaimer className="mb-10" />
      <div className="mb-10 flex flex-col justify-between gap-4 border-b border-[rgba(212,175,55,0.16)] pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="kicker mb-3">Account</p>
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.03em] text-white">
            {user.firstName} {user.lastName}
          </h1>
          <p className="mt-3 text-[15px] text-[#8f8c84]">{user.email}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Sign out
        </button>
      </div>

      <div className="mb-14 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <article key={item.title} className="surface p-5">
            <div className="mb-3 text-[#d4af37]">
              <item.icon className="h-6 w-6" />
            </div>
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.14em] text-[#d4af37] uppercase">
              {item.title}
            </h2>
            <p className="mb-2 text-[20px] font-semibold tracking-[-0.03em]">{item.value}</p>
            <p className="text-[13px] leading-6 text-[#8f8c84]">{item.text}</p>
          </article>
        ))}
      </div>

      <section className="mb-14" id="history">
        <h2 className="mb-2 text-[13px] font-semibold tracking-[0.12em] uppercase">
          Full history
        </h2>
        <p className="mb-6 max-w-2xl text-[14px] leading-6 text-[#8f8c84]">
          Every order, COA, and tracking number. Paid checkouts while signed in
          are stored here. Guest orders are attached if you later create an
          account with the same email.
        </p>
        {user.orders.length === 0 ? (
          <div className="surface p-8 text-sm leading-7 text-[#8f8c84]">
            No orders yet.{" "}
            <Link href="/shop" className="text-[#d4af37]">
              Browse the catalogue
            </Link>{" "}
            and complete checkout while signed in.
          </div>
        ) : (
          <div className="space-y-4">
            {user.orders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section className="mb-14" id="credit">
        <h2 className="mb-2 text-[13px] font-semibold tracking-[0.12em] uppercase">
          Store credit
        </h2>
        <p className="mb-6 max-w-2xl text-[14px] leading-6 text-[#8f8c84]">
          Apply your store credit automatically at checkout. Issued credit is
          deducted from the amount charged; you do not enter a code. Checkout
          code DGC20 is entered on the cart or checkout page and takes 20% off
          the order total before store credit.
        </p>
        <div className="surface p-6">
          <p className="text-[28px] font-semibold tracking-[-0.03em] text-[#d4af37]">
            {formatPrice(centsToDollars(user.storeCreditCents))}
          </p>
          <p className="mt-2 text-sm text-[#8f8c84]">Available balance</p>
          {user.creditLedger.length === 0 ? (
            <p className="mt-6 text-sm leading-7 text-[#8f8c84]">
              No credit movements yet. Refunds and batch adjustments issued by
              Redline Labs appear in this ledger and apply on the next checkout.
            </p>
          ) : (
            <ul className="mt-6 space-y-3 text-sm">
              {user.creditLedger.map((entry) => (
                <li key={entry.id} className="flex justify-between gap-4 border-t border-[rgba(212,175,55,0.16)] pt-3">
                  <span>
                    <span className="block text-white">{entry.note}</span>
                    <span className="text-[12px] text-[#8f8c84]">
                      {new Date(entry.at).toLocaleDateString("en-AU")}
                    </span>
                  </span>
                  <span className="text-[#d4af37]">
                    {entry.amountCents > 0 ? "+" : ""}
                    {formatPrice(centsToDollars(entry.amountCents))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mb-14" id="addresses">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="mb-2 text-[13px] font-semibold tracking-[0.12em] uppercase">
              Saved addresses
            </h2>
            <p className="max-w-2xl text-[14px] leading-6 text-[#8f8c84]">
              Auto-fill at checkout, edit any time. The default address is sent
              through to Stripe as the shipping details.
            </p>
          </div>
          {editing === null && (
            <button type="button" className="btn" onClick={() => setEditing("new")}>
              Add address
            </button>
          )}
        </div>
        {editing && (
          <div className="surface mb-6 p-6">
            <AddressForm
              initial={editing === "new" ? undefined : editing}
              submitLabel={editing === "new" ? "Save address" : "Update address"}
              onSubmit={(input) => {
                saveAddress(input, editing === "new" ? undefined : editing.id);
                setEditing(null);
              }}
              onCancel={() => setEditing(null)}
            />
          </div>
        )}
        {user.addresses.length === 0 && editing === null ? (
          <div className="surface p-8 text-sm leading-7 text-[#8f8c84]">
            No saved addresses yet. Add one to auto-fill Australian shipping at
            checkout.
          </div>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {user.addresses.map((address) => (
              <li key={address.id} className="surface flex flex-col p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-[15px] font-semibold">{address.label}</p>
                  {address.isDefault && (
                    <span className="text-[11px] tracking-[0.12em] text-[#d4af37] uppercase">
                      Default
                    </span>
                  )}
                </div>
                <p className="text-sm leading-6 text-[#8f8c84]">
                  {address.firstName} {address.lastName}
                  <br />
                  {formatAddress(address)}
                  {address.phone ? (
                    <>
                      <br />
                      {address.phone}
                    </>
                  ) : null}
                </p>
                <div className="mt-4 flex flex-wrap gap-3 text-[12px] tracking-[0.08em] uppercase">
                  <button type="button" className="text-[#d4af37]" onClick={() => setEditing(address)}>
                    Edit
                  </button>
                  {!address.isDefault && (
                    <button
                      type="button"
                      className="text-[#cfc8b8] hover:text-[#d4af37]"
                      onClick={() => makeDefaultAddress(address.id)}
                    >
                      Make default
                    </button>
                  )}
                  <button
                    type="button"
                    className="text-[#cfc8b8] hover:text-[#d4af37]"
                    onClick={() => deleteAddress(address.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="alerts">
        <h2 className="mb-2 text-[13px] font-semibold tracking-[0.12em] uppercase">
          Stock alerts
        </h2>
        <p className="mb-6 max-w-2xl text-[14px] leading-6 text-[#8f8c84]">
          Get pinged when batches restock. Open a listing and choose notify me,
          or manage watches here.
        </p>
        {user.stockAlerts.length === 0 ? (
          <div className="surface p-8 text-sm leading-7 text-[#8f8c84]">
            You are not watching any listings.{" "}
            <Link href="/shop" className="text-[#d4af37]">
              Browse the catalogue
            </Link>{" "}
            and add a restock alert on a product page.
          </div>
        ) : (
          <ul className="space-y-3">
            {user.stockAlerts.map((alert) => (
              <li
                key={alert.slug}
                className="surface flex flex-wrap items-center justify-between gap-3 p-5"
              >
                <div>
                  <Link href={`/product/${alert.slug}`} className="font-medium hover:text-[#d4af37]">
                    {alert.name}
                  </Link>
                  <p className="text-[12px] text-[#8f8c84]">
                    SKU {alert.sku || "not listed"} · watching since{" "}
                    {new Date(alert.createdAt).toLocaleDateString("en-AU")}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => unwatchProduct(alert.slug)}
                >
                  Stop alert
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function OrderCard({ order }: { order: OrderRecord }) {
  const trackingHref = order.trackingNumber
    ? order.trackingUrl || auspostTrackingUrl(order.trackingNumber)
    : trackingMailto(order);

  return (
    <article className="surface p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-semibold text-white">{order.id}</p>
          <p className="text-[12px] text-[#8f8c84]">
            {new Date(order.createdAt).toLocaleString("en-AU")} · {order.status}
          </p>
        </div>
        <p className="text-[#d4af37]">{formatPrice(centsToDollars(order.totalCents))}</p>
      </div>
      <ul className="mb-4 space-y-2 text-sm text-[#cfc8b8]">
        {order.items.map((line, index) => (
          <li key={`${line.slug}-${line.option}-${index}`} className="flex flex-wrap justify-between gap-3">
            <span>
              {lineDisplayName(line)} × {line.qty}
              <span className="mt-1 block text-[12px] text-[#8f8c84]">SKU {line.sku || "not listed"}</span>
            </span>
            <a href={coaMailto(order, line)} className="text-[12px] tracking-[0.08em] text-[#d4af37] uppercase">
              Request COA
            </a>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(212,175,55,0.16)] pt-4 text-sm">
        <p className="text-[#8f8c84]">
          Tracking{" "}
          {order.trackingNumber ? (
            <a href={trackingHref} className="text-[#d4af37]" target="_blank" rel="noreferrer">
              {order.trackingNumber}
            </a>
          ) : (
            <a href={trackingHref} className="text-[#d4af37]">
              assigned at dispatch
            </a>
          )}
        </p>
        {order.storeCreditCents > 0 && (
          <p className="text-[#8f8c84]">
            Credit applied {formatPrice(centsToDollars(order.storeCreditCents))}
          </p>
        )}
      </div>
    </article>
  );
}
