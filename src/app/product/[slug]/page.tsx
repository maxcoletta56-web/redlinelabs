import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { AddToCart } from "@/components/AddToCart";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CoaSection } from "@/components/CoaSection";
import { JsonLd } from "@/components/JsonLd";
import { ProductCard } from "@/components/ProductCard";
import { ProductImage } from "@/components/ProductImage";
import { ResearchDisclaimer } from "@/components/ResearchDisclaimer";
import { StockAlertButton } from "@/components/StockAlertButton";
import { getProduct, optionLabel, products, relatedProducts, type Product } from "@/lib/products";
import { absoluteUrl, pageMetadata } from "@/lib/seo";
import { canonicalProductSlug } from "@/lib/slugs";

type Props = { params: Promise<{ slug: string }> };

export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams() {
  return products.map((p) => ({ slug: p.slug }));
}

function productImageAlt(name: string, option?: string) {
  const size = option ? ` ${option}` : "";
  return `${name}${size} research vial`;
}

function productJsonLd(product: Product) {
  const url = absoluteUrl(`/product/${product.slug}`);
  const offers =
    product.variants.length > 1
      ? {
          "@type": "AggregateOffer",
          priceCurrency: "AUD",
          lowPrice: product.minPrice,
          highPrice: product.maxPrice,
          offerCount: product.variants.length,
          availability: "https://schema.org/InStock",
          url,
          offers: product.variants.map((variant) => ({
            "@type": "Offer",
            price: variant.price,
            priceCurrency: "AUD",
            availability: "https://schema.org/InStock",
            sku: variant.sku,
            name: optionLabel(product, variant.option),
            url,
          })),
        }
      : {
          "@type": "Offer",
          price: product.minPrice,
          priceCurrency: "AUD",
          availability: "https://schema.org/InStock",
          sku: product.variants[0]?.sku || product.sku,
          url,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    sku: product.sku || undefined,
    image: product.image.startsWith("http") ? product.image : absoluteUrl(product.image),
    brand: { "@type": "Brand", name: "Redline Labs" },
    category: product.categories[0],
    url,
    offers,
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return { title: "Product" };
  return pageMetadata({
    title: product.name,
    description: product.description,
    path: `/product/${product.slug}`,
    image: product.image,
    imageAlt: productImageAlt(product.name, product.variants[0]?.option),
  });
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const canonical = canonicalProductSlug(slug);
  if (canonical !== slug) {
    if (getProduct(canonical)) permanentRedirect(`/product/${canonical}`);
    notFound();
  }
  const product = getProduct(slug);
  if (!product) notFound();
  const related = relatedProducts(product);
  const imageAlt = productImageAlt(product.name, product.variants[0]?.option);

  return (
    <div className="wrap py-12">
      <JsonLd data={productJsonLd(product)} />
      <Breadcrumbs
        items={[
          { href: "/", label: "Home" },
          { href: "/shop", label: "Catalogue" },
          { label: product.name },
        ]}
      />
      <ResearchDisclaimer className="mb-10" />
      <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="surface relative aspect-square overflow-hidden">
          <ProductImage
            src={product.image}
            alt={imageAlt}
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
            {product.name}
          </h1>
          <AddToCart product={product} />
          <div className="mt-5">
            <StockAlertButton slug={product.slug} name={product.name} sku={product.sku} />
          </div>
          <div className="mt-10 border-t border-[rgba(212,175,55,0.16)] pt-8">
            <h2 className="mb-3 text-[13px] font-semibold tracking-[0.12em] text-white uppercase">
              Description
            </h2>
            <p className="text-[15px] leading-8 text-[#8f8c84]">{product.description}</p>
          </div>
          <CoaSection product={product} />
        </div>
      </div>

      {related.length > 0 && (
        <section className="mt-20 border-t border-[rgba(212,175,55,0.16)] pt-14">
          <p className="kicker mb-3">Catalogue</p>
          <h2 className="section-title mb-10">Related listings</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {related.map((item) => (
              <ProductCard key={item.slug} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
