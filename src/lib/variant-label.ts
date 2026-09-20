export function isDoseOption(option: string) {
  return /^[\d,]+(?:\s*\/\s*[\d,]+)?$/.test(option.trim());
}

export function optionLabel(
  product: { variantLabel?: string | null },
  option: string,
) {
  if (!isDoseOption(option)) return option;
  const unit = product.variantLabel;
  if (unit === "MG") return `${option} MG`;
  if (unit === "IU" || unit === "Iu") return `${option} IU`;
  return unit ? `${option} ${unit}` : option;
}

export function variantGroupLabel(product: {
  variantLabel?: string | null;
  variants: Array<{ option: string }>;
}) {
  const options = product.variants.map((variant) => variant.option);
  const mixed = options.some(isDoseOption) && options.some((option) => !isDoseOption(option));
  if (mixed) return "Option";
  return product.variantLabel ?? "Option";
}
