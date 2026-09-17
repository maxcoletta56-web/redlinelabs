"use client";

import { useState } from "react";
import { Field, SelectField } from "@/components/Field";
import { AU_STATES, type AddressInput, type SavedAddress } from "@/lib/account-data";

const empty: AddressInput = {
  label: "Lab",
  firstName: "",
  lastName: "",
  line1: "",
  line2: "",
  city: "",
  state: "NSW",
  postcode: "",
  phone: "",
  isDefault: false,
};

function fromSaved(address: SavedAddress): AddressInput {
  return {
    label: address.label,
    firstName: address.firstName,
    lastName: address.lastName,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    postcode: address.postcode,
    phone: address.phone,
    isDefault: address.isDefault,
  };
}

export function AddressForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial?: SavedAddress;
  submitLabel: string;
  onSubmit: (input: AddressInput) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<AddressInput>(initial ? fromSaved(initial) : empty);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        try {
          onSubmit(values);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Could not save this address");
        }
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="addr-label"
          label="Label"
          value={values.label}
          onChange={(event) => setValues((current) => ({ ...current, label: event.target.value }))}
          placeholder="Lab, warehouse, receiving"
        />
        <Field
          id="addr-phone"
          label="Phone"
          type="tel"
          autoComplete="tel"
          value={values.phone}
          onChange={(event) => setValues((current) => ({ ...current, phone: event.target.value }))}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="addr-first"
          label="First name"
          required
          autoComplete="given-name"
          value={values.firstName}
          onChange={(event) => setValues((current) => ({ ...current, firstName: event.target.value }))}
        />
        <Field
          id="addr-last"
          label="Last name"
          required
          autoComplete="family-name"
          value={values.lastName}
          onChange={(event) => setValues((current) => ({ ...current, lastName: event.target.value }))}
        />
      </div>
      <Field
        id="addr-line1"
        label="Address line 1"
        required
        autoComplete="address-line1"
        value={values.line1}
        onChange={(event) => setValues((current) => ({ ...current, line1: event.target.value }))}
      />
      <Field
        id="addr-line2"
        label="Address line 2"
        autoComplete="address-line2"
        value={values.line2}
        onChange={(event) => setValues((current) => ({ ...current, line2: event.target.value }))}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          id="addr-city"
          label="Suburb / city"
          required
          autoComplete="address-level2"
          value={values.city}
          onChange={(event) => setValues((current) => ({ ...current, city: event.target.value }))}
        />
        <SelectField
          id="addr-state"
          label="State"
          required
          autoComplete="address-level1"
          value={values.state}
          onChange={(event) => setValues((current) => ({ ...current, state: event.target.value }))}
        >
          {AU_STATES.map((state) => (
            <option key={state} value={state}>
              {state}
            </option>
          ))}
        </SelectField>
        <Field
          id="addr-postcode"
          label="Postcode"
          required
          inputMode="numeric"
          autoComplete="postal-code"
          value={values.postcode}
          onChange={(event) => setValues((current) => ({ ...current, postcode: event.target.value }))}
        />
      </div>
      <label className="flex items-start gap-3 text-sm leading-6 text-[#8f8c84]">
        <input
          type="checkbox"
          className="mt-1"
          checked={Boolean(values.isDefault)}
          onChange={(event) =>
            setValues((current) => ({ ...current, isDefault: event.target.checked }))
          }
        />
        Use as the default checkout address
      </label>
      {error && (
        <p className="text-sm text-[#d4af37]" role="alert">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="btn">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
