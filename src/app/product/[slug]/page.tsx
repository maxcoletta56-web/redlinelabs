import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
import { getProduct, products, relatedProducts } from "@/lib/products";

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
      <p className="mb-8 text-xs tracking-wide text-[#7d786c]">
        <Link href="/shop" className="hover:text-[#d4af37]">
          Catalogue
        </Link>
        <span className="mx-2">/</span>
        {product.name}
      </p>
      <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="border border-[rgba(212,175,55,0.14)] bg-[#0a0a0a] p-8">
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
        <div className="lg:pt-2">
          <p className="kicker mb-3">{product.categories[0] ?? "Research"}</p>
          <h1 className="font-serif mb-4 text-5xl font-medium tracking-tight">{product.name}</h1>
          <p className="mb-8 text-sm text-[#7d786c]">SKU {product.sku || "—"}</p>
          <AddToCart product={product} />
          <p className="mt-10 text-[15px] leading-8 text-[#cfc8b8]">{product.description}</p>
          <p className="mt-8 border-t border-[rgba(212,175,55,0.14)] pt-6 text-xs leading-6 text-[#a7a193]">
            For laboratory research use only. Not for human or veterinary
            consumption, diagnostic, or therapeutic applications.
          </p>
        </div>
      </div>

      <section className="mt-20">
        <h2 className="font-serif mb-8 text-3xl font-medium">Related materials</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
