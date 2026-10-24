const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,40}$/;

/** Form field for one catalogue SKU. The price is never taken from this field. */
export function boxFieldName(sku: string) {
  return `box_${sku}`;
}

export function boxFieldSku(fieldName: string): string | null {
  if (!fieldName.startsWith("box_")) return null;
  const sku = fieldName.slice(4);
  return SKU_PATTERN.test(sku) ? sku : null;
}

/** Admin field for the price of one box. The distributor cannot set this. */
export function priceFieldName(sku: string) {
  return `price_${sku}`;
}
