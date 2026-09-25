import { COMPANY_EMAIL } from "@/lib/company";
import type { Product } from "@/lib/products";

function requestMailto(product: Product) {
  const subject = `COA request: ${product.name} (${product.sku})`;
  const body = [
    `Please send the Certificate of Analysis for ${product.name}.`,
    `SKU: ${product.sku}`,
    product.lotNumber ? `Lot: ${product.lotNumber}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  return `mailto:${COMPANY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export function CoaSection({ product }: { product: Product }) {
  const hasCoa = Boolean(product.coaUrl);
  const hasLot = Boolean(product.lotNumber);

  return (
    <section className="mt-8 border-t border-[rgba(212,175,55,0.16)] pt-8">
      <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
        Certificate of Analysis
      </h2>
      <p className="text-[15px] leading-7 text-[#8f8c84]">
        SKU {product.sku || "not listed"}
        {hasLot ? ` · Lot ${product.lotNumber}` : ""}
      </p>
      {hasCoa ? (
        <p className="mt-3 text-[15px] leading-7 text-[#8f8c84]">
          <a
            href={product.coaUrl ?? undefined}
            className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
            target="_blank"
            rel="noreferrer"
          >
            View COA
          </a>
          {hasLot ? ` for lot ${product.lotNumber}.` : "."}
        </p>
      ) : (
        <p className="mt-3 text-[15px] leading-7 text-[#8f8c84]">
          COA available on request. Email{" "}
          <a
            href={requestMailto(product)}
            className="text-[#d4af37] underline decoration-[#d4af37]/40 underline-offset-3"
          >
            {COMPANY_EMAIL}
          </a>{" "}
          with SKU {product.sku || product.name}.
        </p>
      )}
    </section>
  );
}
