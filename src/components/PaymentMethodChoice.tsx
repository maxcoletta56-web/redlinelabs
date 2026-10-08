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
  methods: CheckoutPaymentMethod[];
  defaultMethod: CheckoutPaymentMethod;
  setup: CheckoutPaymentMethod | null;
  configured: boolean | null;
};

export function useCheckoutAvailability(): CheckoutAvailability {
  const [state, setState] = useState<CheckoutAvailability>({
    ready: false,
    showChoice: false,
    methods: ["bank_transfer"],
    defaultMethod: paymentsProvider() === "paypal" ? "paypal" : "bank_transfer",
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
          methods?: string[];
          defaultMethod?: string;
          setup?: string | null;
          configured?: boolean;
        }) => {
          if (cancelled) return;
          const methods = (Array.isArray(data.methods) ? data.methods : [])
            .filter(
              (method): method is CheckoutPaymentMethod =>
                method === "bank_transfer" || method === "whop" || method === "paypal",
            );
          const defaultMethod =
            data.defaultMethod === "paypal" || data.defaultMethod === "whop"
              ? data.defaultMethod
              : "bank_transfer";
          const setup =
            data.setup === "paypal" || data.setup === "bank_transfer" || data.setup === "whop"
              ? data.setup
              : null;
          setState({
            ready: true,
            showChoice: Boolean(data.showChoice),
            methods: methods.length > 0 ? methods : [defaultMethod],
            defaultMethod,
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

function isCheckoutMethod(value: string | null): value is CheckoutPaymentMethod {
  return value === "bank_transfer" || value === "whop" || value === "paypal";
}

export function useSelectedPaymentMethod(
  showChoice: boolean,
  methods: readonly CheckoutPaymentMethod[] = ["bank_transfer"],
) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>("bank_transfer");
  const available = methods.join(",");

  useEffect(() => {
    if (!showChoice) return;
    const allowed = new Set(available.split(",").filter(isCheckoutMethod));
    const apply = () => {
      try {
        const query = new URLSearchParams(window.location.search).get("pay");
        const fromQuery =
          query === "payid" || query === "bank"
            ? "bank_transfer"
            : query === "card"
              ? "whop"
              : query;
        if (isCheckoutMethod(fromQuery) && allowed.has(fromQuery)) {
          setMethod(fromQuery);
          window.sessionStorage.setItem(STORAGE_KEY, fromQuery);
          return;
        }
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        setMethod(isCheckoutMethod(stored) && allowed.has(stored) ? stored : "bank_transfer");
      } catch {
        setMethod("bank_transfer");
      }
    };
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    return () => window.removeEventListener(CHANGE_EVENT, apply);
  }, [showChoice, available]);

  function choose(next: CheckoutPaymentMethod) {
    setMethod(next);
    try {
      window.sessionStorage.setItem(STORAGE_KEY, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      /* private mode still keeps the in-memory choice */
    }
  }

  return { method: showChoice ? method : "bank_transfer", choose };
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
