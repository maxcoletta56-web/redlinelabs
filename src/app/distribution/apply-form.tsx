"use client";

import { useActionState } from "react";
import { Field, SelectField, TextAreaField } from "@/components/Field";
import { AU_STATES } from "@/lib/account-data";
import { applyForDistribution, type DistributionFormState } from "./actions";

const initialState: DistributionFormState = { error: null };

export function ApplyForm() {
  const [state, action, pending] = useActionState(applyForDistribution, initialState);

  return (
    <form action={action} className="space-y-4">
      <Field id="dist-business" name="businessName" label="Business name" required autoComplete="organization" maxLength={120} />
      <Field id="dist-contact" name="contactName" label="Contact name" required autoComplete="name" maxLength={120} />
      <Field id="dist-email" name="email" label="Email" type="email" required autoComplete="email" />
      <Field id="dist-phone" name="phone" label="Phone" type="tel" required autoComplete="tel" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="dist-abn" name="abn" label="ABN (optional)" inputMode="numeric" autoComplete="off" />
        <SelectField id="dist-region" name="region" label="Region" required defaultValue="">
          <option value="" disabled>
            Select
          </option>
          {AU_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
          <option value="OTHER">Outside Australia</option>
        </SelectField>
      </div>
      <Field id="dist-website" name="website" label="Website (optional)" type="url" autoComplete="url" placeholder="https://" />
      <TextAreaField id="dist-message" name="message" label="What you supply and who you supply" rows={4} maxLength={1000} />
      <Field
        id="dist-password"
        name="password"
        label="Password"
        type="password"
        required
        autoComplete="new-password"
        minLength={8}
      />
      <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
        <input type="checkbox" name="ageConfirmed" required className="mt-1" />
        I confirm I am 18 years of age or older.
      </label>
      <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
        <input type="checkbox" name="researchUse" required className="mt-1" />
        I confirm this request is for legitimate laboratory research supply and not for human or veterinary consumption.
      </label>
      {state.error ? (
        <p role="alert" className="text-sm leading-6 text-[#d4af37]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="btn min-h-11 w-full" disabled={pending}>
        {pending ? "Sending application" : "Submit application"}
      </button>
    </form>
  );
}
