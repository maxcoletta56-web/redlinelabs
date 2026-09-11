import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CoaSection } from "@/components/CoaSection";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import {
  displayName,
  getProduct,
  products,
  relatedListings,
} from "@/lib/products";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ option?: string }>;
};

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { slug } = await params;
  const { option } = await searchParams;
  const product = getProduct(slug);
  if (!product) return { title: "Product" };
  const variant = product.variants.find((item) => item.option === option) ?? null;
  return {
    title: displayName(product, variant),
    description: product.description.slice(0, 150),
  };
}

export default async function ProductPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { option } = await searchParams;
  const product = getProduct(slug);
  if (!product) notFound();
  const selected =
    product.variants.find((item) => item.option === option) ?? product.variants[0] ?? null;
  const related = relatedListings(product, selected?.option ?? null);

  return (
    <div className="wrap py-12">
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Catalogue" },
          { label: displayName(product, selected) },
        ]}
      />
      <ResearchDisclaimer className="mb-10" />
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="surface relative aspect-square overflow-hidden">
          <ProductImage
            src={product.image}
            alt={displayName(product, selected)}
            fill
            className="object-contain p-10"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>
        <div>
          {product.categories[0] && (
            <p className="kicker mb-3">{product.categories[0]}</p>
          )}
          <h1 className="mb-6 text-[2.1rem] leading-tight font-semibold tracking-[-0.03em] text-white">
            {displayName(product, selected)}
          </h1>
          <AddToCart
            key={`${product.slug}-${selected?.option ?? "default"}`}
            product={product}
            initialOption={selected?.option ?? null}
          />
          <div className="mt-10 border-t border-[rgba(212,175,55,0.16)] pt-8">
            <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Description
            </h2>
            <p className="text-[15px] leading-8 text-[#cfc8b8]">{product.description}</p>
          </div>
          <CoaSection sku={selected?.sku || product.sku} />
        </div>
      </div>

      <section className="mt-20 border-t border-[rgba(212,175,55,0.16)] pt-14">
        <p className="kicker mb-3">Catalogue</p>
        <h2 className="section-title mb-10">Related listings</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.listingKey} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
