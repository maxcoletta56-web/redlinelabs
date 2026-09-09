import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

type FieldLabelProps = {
  id: string;
  label: string;
  children: ReactNode;
};

function FieldLabel({ id, label, children }: FieldLabelProps) {
  return (
    <label htmlFor={id} className="block">
      <span className="mb-2 block text-[11px] font-semibold tracking-[0.12em] text-[#cfc8b8] uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  id: string;
  label: string;
};

export function Field({ id, label, className = "field", ...props }: InputProps) {
  return (
    <FieldLabel id={id} label={label}>
      <input id={id} className={className} {...props} />
    </FieldLabel>
  );
}

type AreaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  id: string;
  label: string;
};

export function TextAreaField({ id, label, className = "field", ...props }: AreaProps) {
  return (
    <FieldLabel id={id} label={label}>
      <textarea id={id} className={className} {...props} />
    </FieldLabel>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  label: string;
};

export function SelectField({
  id,
  label,
  className = "field",
  children,
  ...props
}: SelectProps) {
  return (
    <FieldLabel id={id} label={label}>
      <select id={id} className={className} {...props}>
        {children}
      </select>
    </FieldLabel>
  );
}
