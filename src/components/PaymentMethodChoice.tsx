"use client";

import { useEffect, useState } from "react";
import {
  CHECKOUT_METHOD_LABELS,
  paymentsProvider,
  type CheckoutPaymentMethod,
} from "@/lib/payments-provider";

const STORAGE_KEY = "rl-checkout-payment-method";
const CHANGE_EVENT = "rl-payment-method";

export type CheckoutAvailability = {
  ready: boolean;
  showChoice: boolean;
  defaultMethod: CheckoutPaymentMethod;
  methods: CheckoutPaymentMethod[];
  setup: CheckoutPaymentMethod | null;
  configured: boolean | null;
};

function knownMethod(value: string | undefined): CheckoutPaymentMethod | null {
  if (value === "paypal" || value === "whop" || value === "bank_transfer") return value;
  return null;
}

export function useCheckoutAvailability(): CheckoutAvailability {
  const [state, setState] = useState<CheckoutAvailability>({
    ready: false,
    showChoice: false,
    defaultMethod: paymentsProvider() === "paypal" ? "paypal" : "bank_transfer",
    methods: ["bank_transfer"],
    setup: null,
    configured: null,
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/checkout")
      .then((res) => res.json())
      .then(
        (data: {
          showChoice?: boolean;
          defaultMethod?: string;
          methods?: unknown;
          setup?: string | null;
          configured?: boolean;
        }) => {
          if (cancelled) return;
          const methods = Array.isArray(data.methods)
            ? data.methods.filter((method): method is CheckoutPaymentMethod => knownMethod(typeof method === "string" ? method : undefined) !== null)
            : [];
          const defaultMethod = knownMethod(data.defaultMethod) ?? (methods[0] ?? "bank_transfer");
          const setup = knownMethod(data.setup ?? undefined);
          setState({
            ready: true,
            showChoice: Boolean(data.showChoice),
            defaultMethod,
            methods: methods.length > 0 ? methods : [defaultMethod],
            setup,
            configured: Boolean(data.configured),
          });
        },
      )
      .catch(() => {
        if (!cancelled) {
          setState((current) => ({ ...current, ready: true, configured: false }));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function useSelectedPaymentMethod(showChoice: boolean, methods: readonly CheckoutPaymentMethod[]) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>("bank_transfer");

  useEffect(() => {
    if (!showChoice) return;
    const allowed = (candidate: string | null | undefined) =>
      knownMethod(candidate ?? undefined) && methods.includes(knownMethod(candidate ?? undefined) as CheckoutPaymentMethod)
        ? (knownMethod(candidate ?? undefined) as CheckoutPaymentMethod)
        : null;
    const apply = () => {
      try {
        const query = new URLSearchParams(window.location.search).get("pay");
        const fromQuery =
          query === "card" || query === "whop"
            ? allowed("whop")
            : query === "paypal"
              ? allowed("paypal")
              : query === "payid" || query === "bank_transfer"
                ? allowed("bank_transfer")
                : null;
        if (fromQuery) {
          setMethod(fromQuery);
          window.sessionStorage.setItem(STORAGE_KEY, fromQuery);
          return;
        }
        const stored = allowed(window.sessionStorage.getItem(STORAGE_KEY));
        setMethod(stored ?? methods[0] ?? "bank_transfer");
      } catch {
        setMethod(methods[0] ?? "bank_transfer");
      }
    };
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    return () => window.removeEventListener(CHANGE_EVENT, apply);
  }, [showChoice, methods]);

  function choose(next: CheckoutPaymentMethod) {
    setMethod(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* private mode still keeps the in-memory choice */
    }
  }

  return { method: showChoice ? method : (methods[0] ?? "bank_transfer"), choose };
}

export function PaymentMethodChoice({
  value,
  onChange,
  methods,
  name = "paymentMethod",
  stacked = false,
}: {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  methods: readonly CheckoutPaymentMethod[];
  name?: string;
  stacked?: boolean;
}) {
  const options = methods.length > 0 ? methods : (["bank_transfer"] as const);
  return (
    <fieldset>
      <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
        Payment method
      </legend>
      <div
        className={stacked ? "grid gap-2" : "grid gap-2 sm:grid-cols-2"}
        role="radiogroup"
        aria-label="Payment method"
      >
        {options.map((option) => (
          <label
            key={option}
            className="surface flex cursor-pointer items-start gap-3 p-4 text-sm leading-6"
          >
            <input
              type="radio"
              name={name}
              className="mt-1"
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
            />
            <span className="font-medium text-white">{CHECKOUT_METHOD_LABELS[option]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
