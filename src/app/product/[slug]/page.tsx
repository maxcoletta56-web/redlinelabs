import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import {
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
    <div className="mx-auto max-w-[1200px] px-5 py-12">
      <p className="mb-6 text-xs tracking-wide text-[#9a9a9a]">
        <Link href="/shop" className="hover:text-[#d4af37]">
          Shop
        </Link>{" "}
        / {product.name}
      </p>
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="border border-[rgba(212,175,55,0.16)] bg-[#0a0a0a] p-6">
          <div className="relative aspect-square">
            <Image
              src={product.image}
              alt={product.name}
              fill
              className="object-contain"
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs tracking-[0.22em] text-[#d4af37] uppercase">
            {product.categories[0] ?? "Research"}
          </p>
          <h1 className="mb-4 text-4xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mb-6 text-sm text-[#9a9a9a]">SKU: {product.sku || "—"}</p>
          <AddToCart product={product} />
          <p className="mt-8 text-sm leading-8 text-[#cfcfcf]">{product.description}</p>
          <div className="mt-6 rounded-xl border border-[rgba(212,175,55,0.2)] bg-[rgba(212,175,55,0.05)] p-4 text-xs leading-6 text-[#d4af37]">
            For laboratory research use only. Not for human or veterinary
            consumption, diagnostic, or therapeutic applications.
          </div>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="mb-8 text-2xl font-bold">Related products</h2>
        <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
