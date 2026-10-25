"use client";

import { useActionState } from "react";
import { Field } from "@/components/Field";
import { loginDistribution, type DistributionFormState } from "./actions";

const initialState: DistributionFormState = { error: null };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginDistribution, initialState);

  return (
    <form action={action} className="space-y-4">
      <Field id="dist-login-email" name="email" label="Email" type="email" required autoComplete="email" />
      <Field
        id="dist-login-password"
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="current-password"
      />
      {state.error ? (
        <p role="alert" className="text-sm leading-6 text-[#d4af37]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn min-h-11 w-full" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
