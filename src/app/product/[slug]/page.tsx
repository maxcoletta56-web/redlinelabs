import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { CoaSection } from "@/components/CoaSection";
import { ProductCard } from "@/components/ProductCard";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import {
  displayName,
  getProduct,
  products,
  relatedProducts,
} from "@/lib/products";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product" };
  return {
    title: product.name,
    description: product.description.slice(0, 150),
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  const related = relatedProducts(product);

  return (
    <div className="wrap py-12">
      <p className="mb-6 text-[12px] tracking-[0.04em] text-[#8f8c84]">
        <Link href="/" className="hover:text-[#d4af37]">
          Home
        </Link>
        <span className="mx-2 text-white/20">/</span>
        <Link href="/shop" className="hover:text-[#d4af37]">
          Catalogue
        </Link>
        <span className="mx-2 text-white/20">/</span>
        {product.name}
      </p>
      <ResearchDisclaimer className="mb-10" />
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="surface relative aspect-square overflow-hidden">
          <Image
            src={product.image}
            alt={product.name}
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
            {displayName(product)}
          </h1>
          <AddToCart product={product} />
          <p className="mt-6 text-[12px] tracking-[0.04em] text-[#8f8c84]">
            SKU {product.sku || "not listed"} · Lot number not published
          </p>
          <div className="mt-10 border-t border-[rgba(212,175,55,0.16)] pt-8">
            <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Description
            </h2>
            <p className="text-[15px] leading-8 text-[#cfc8b8]">{product.description}</p>
          </div>
          <CoaSection sku={product.sku} />
        </div>
      </div>

      <section className="mt-20 border-t border-[rgba(212,175,55,0.16)] pt-14">
        <p className="kicker mb-3">Catalogue</p>
        <h2 className="section-title mb-10">Related listings</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
