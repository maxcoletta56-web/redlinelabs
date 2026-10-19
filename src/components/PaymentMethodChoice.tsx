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
  setup: "bank_transfer" | "paypal" | null;
  configured: boolean | null;
  whopEnvironment: "sandbox" | "production" | null;
};

function asMethod(value: unknown): CheckoutPaymentMethod | null {
  if (value === "bank_transfer" || value === "paypal" || value === "whop") return value;
  return null;
}

export function useCheckoutAvailability(): CheckoutAvailability {
  const [state, setState] = useState<CheckoutAvailability>({
    ready: false,
    showChoice: false,
    defaultMethod: paymentsProvider() === "paypal" ? "paypal" : "bank_transfer",
    methods: [paymentsProvider() === "paypal" ? "paypal" : "bank_transfer"],
    setup: null,
    configured: null,
    whopEnvironment: null,
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
          whopEnvironment?: string | null;
        }) => {
          if (cancelled) return;
          const methods = Array.isArray(data.methods)
            ? data.methods.map(asMethod).filter((method): method is CheckoutPaymentMethod => method !== null)
            : [];
          const fallback = paymentsProvider() === "paypal" ? "paypal" : "bank_transfer";
          const resolved = methods.length > 0 ? methods : [fallback];
          const requestedDefault = asMethod(data.defaultMethod);
          const defaultMethod =
            requestedDefault && resolved.includes(requestedDefault) ? requestedDefault : resolved[0] ?? fallback;
          const setup =
            data.setup === "paypal" || data.setup === "bank_transfer" ? data.setup : null;
          setState({
            ready: true,
            showChoice: Boolean(data.showChoice) && resolved.length > 1,
            defaultMethod,
            methods: resolved,
            setup,
            configured: Boolean(data.configured),
            whopEnvironment:
              data.whopEnvironment === "sandbox" || data.whopEnvironment === "production"
                ? data.whopEnvironment
                : null,
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

function methodFromToken(value: string | null): CheckoutPaymentMethod | null {
  if (value === "paypal") return "paypal";
  if (value === "card" || value === "whop") return "whop";
  if (value === "payid" || value === "bank_transfer") return "bank_transfer";
  return null;
}

export function useSelectedPaymentMethod(methods: readonly CheckoutPaymentMethod[]) {
  const showChoice = methods.length > 1;
  const fallback = methods.includes("bank_transfer") ? "bank_transfer" : methods[0] ?? "bank_transfer";
  const [method, setMethod] = useState<CheckoutPaymentMethod>(fallback);

  useEffect(() => {
    if (!showChoice) return;
    const apply = () => {
      const allowed = new Set(methods);
      const pick = (candidate: CheckoutPaymentMethod | null) =>
        candidate && allowed.has(candidate) ? candidate : fallback;
      try {
        const query = methodFromToken(new URLSearchParams(window.location.search).get("pay"));
        if (query && allowed.has(query)) {
          setMethod(query);
          window.sessionStorage.setItem(STORAGE_KEY, query);
          return;
        }
        setMethod(pick(methodFromToken(window.sessionStorage.getItem(STORAGE_KEY))));
      } catch {
        setMethod(fallback);
      }
    };
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    return () => window.removeEventListener(CHANGE_EVENT, apply);
  }, [showChoice, methods, fallback]);

  function choose(next: CheckoutPaymentMethod) {
    if (!methods.includes(next)) return;
    setMethod(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* private mode still keeps the in-memory choice */
    }
  }

  return { method: showChoice ? method : fallback, choose };
}

export function PaymentMethodChoice({
  value,
  onChange,
  options,
  name = "paymentMethod",
  stacked = false,
}: {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  options: readonly CheckoutPaymentMethod[];
  name?: string;
  stacked?: boolean;
}) {
  const columns = stacked ? "" : options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2";
  return (
    <fieldset>
      <legend className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#8f8c84] uppercase">
        Payment method
      </legend>
      <div
        className={`grid gap-2 ${columns}`}
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
