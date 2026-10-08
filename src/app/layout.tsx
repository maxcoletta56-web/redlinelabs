import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { AssistLoopWidget } from "@/components/AssistLoopWidget";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { Providers } from "@/components/Providers";
import { VercelTelemetry } from "@/components/VercelTelemetry";
import {
  BRAND_NAME,
  COMPANY_EMAIL,
  COMPANY_NUMBER,
  INCORPORATION_DATE_ISO,
  LEGAL_NAME,
} from "@/lib/company";
import { absoluteUrl, DEFAULT_OG_IMAGE } from "@/lib/seo";
import "./globals.css";

const sans = localFont({
  src: "./fonts/InterVariable.woff2",
  variable: "--font-inter",
  weight: "100 900",
  display: "swap",
});

const defaultDescription =
  "Redline Labs lists laboratory research chemicals for purchase in Australia. Certificates of analysis on request. Research use only, not a pharmacy.";

export const metadata: Metadata = {
  metadataBase: new URL("https://redlinelabs.shop"),
  title: {
    default: "Redline Labs | Research chemicals, Australia",
    template: "%s | Redline Labs",
  },
  description: defaultDescription,
  alternates: { canonical: absoluteUrl("/") },
  icons: {
    icon: "/brand/icon.jpeg",
    apple: "/brand/icon.jpeg",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "Redline Labs",
    title: "Redline Labs | Research chemicals, Australia",
    description: defaultDescription,
    url: absoluteUrl("/"),
    images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), alt: "Redline Labs research catalogue" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Redline Labs | Research chemicals, Australia",
    description: defaultDescription,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" className={`${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#050505] font-sans text-[#f3f1ea]">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: BRAND_NAME,
              legalName: LEGAL_NAME,
              foundingDate: INCORPORATION_DATE_ISO,
              url: absoluteUrl("/"),
              logo: absoluteUrl("/brand/logo-mark.png"),
              email: COMPANY_EMAIL,
              description:
                "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
              areaServed: {
                "@type": "Country",
                name: "Australia",
              },
              contactPoint: {
                "@type": "ContactPoint",
                email: COMPANY_EMAIL,
                contactType: "customer support",
                areaServed: "AU",
                availableLanguage: "English",
              },
              identifier: {
                "@type": "PropertyValue",
                name: "Hong Kong Company Registration Number",
                value: COMPANY_NUMBER,
              },
              address: {
                "@type": "PostalAddress",
                addressCountry: "HK",
              },
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: BRAND_NAME,
              url: absoluteUrl("/"),
              inLanguage: "en-AU",
              potentialAction: {
                "@type": "SearchAction",
                target: `${absoluteUrl("/shop")}?q={search_term_string}`,
                "query-input": "required name=search_term_string",
              },
            },
          ]}
        />
        <Providers>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </Providers>
        <AssistLoopWidget />
        <VercelTelemetry />
      </body>
    </html>
  );
}
