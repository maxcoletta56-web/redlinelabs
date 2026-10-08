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
  setup: CheckoutPaymentMethod | null;
  configured: boolean | null;
};

export function useCheckoutAvailability(): CheckoutAvailability {
  const [state, setState] = useState<CheckoutAvailability>({
    ready: false,
    showChoice: false,
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
          defaultMethod?: string;
          setup?: string | null;
          configured?: boolean;
        }) => {
          if (cancelled) return;
          const defaultMethod = data.defaultMethod === "paypal" ? "paypal" : "bank_transfer";
          const setup =
            data.setup === "paypal" || data.setup === "bank_transfer" ? data.setup : null;
          setState({
            ready: true,
            showChoice: Boolean(data.showChoice),
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

export function useSelectedPaymentMethod(showChoice: boolean) {
  const [method, setMethod] = useState<CheckoutPaymentMethod>("bank_transfer");

  useEffect(() => {
    if (!showChoice) return;
    const apply = () => {
      try {
        const query = new URLSearchParams(window.location.search).get("pay");
        if (query === "paypal") {
          setMethod("paypal");
          window.sessionStorage.setItem(STORAGE_KEY, "paypal");
          return;
        }
        if (query === "payid" || query === "bank_transfer") {
          setMethod("bank_transfer");
          window.sessionStorage.setItem(STORAGE_KEY, "bank_transfer");
          return;
        }
        const stored = window.sessionStorage.getItem(STORAGE_KEY);
        setMethod(stored === "paypal" ? "paypal" : "bank_transfer");
      } catch {
        setMethod("bank_transfer");
      }
    };
    apply();
    window.addEventListener(CHANGE_EVENT, apply);
    return () => window.removeEventListener(CHANGE_EVENT, apply);
  }, [showChoice]);

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
  name = "paymentMethod",
  stacked = false,
}: {
  value: CheckoutPaymentMethod;
  onChange: (method: CheckoutPaymentMethod) => void;
  name?: string;
  stacked?: boolean;
}) {
  const options: CheckoutPaymentMethod[] = ["bank_transfer", "paypal"];
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
