import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { ProductCard } from "@/components/ProductCard";
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
    <div className="mx-auto max-w-[1180px] px-5 py-10">
      <p className="mb-8 text-sm text-[#9a9a9a]">
        <Link href="/" className="hover:text-[#d4af37]">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/shop" className="hover:text-[#d4af37]">
          Shop
        </Link>
        <span className="mx-2">/</span>
        {product.name}
      </p>
      <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative aspect-square overflow-hidden rounded-xl bg-[#111]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-contain p-8"
            sizes="(max-width: 1024px) 100vw, 45vw"
            priority
          />
        </div>
        <div>
          <h1 className="mb-4 text-3xl font-extrabold sm:text-4xl">
            {displayName(product)}
          </h1>
          <AddToCart product={product} />
          <p className="mt-6 flex items-center gap-2 text-sm text-[#d4af37]">
            In stock
          </p>
          <p className="mt-4 text-sm text-[#9a9a9a]">
            For research purposes only. Not for human consumption.
          </p>
          <div className="mt-8">
            <h2 className="mb-3 text-xl font-bold">Product description</h2>
            <p className="text-[15px] leading-8 text-[#cfcfcf]">{product.description}</p>
          </div>
          <p className="mt-6 text-xs leading-6 text-[#7a7a7a]">SKU {product.sku || "—"}</p>
        </div>
      </div>

      <section className="mt-16">
        <h2 className="mb-8 text-2xl font-bold">Related products</h2>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {related.map((item) => (
            <ProductCard key={item.slug} product={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
