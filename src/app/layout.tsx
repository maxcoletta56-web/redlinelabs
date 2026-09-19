import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { AssistLoopWidget } from "@/components/AssistLoopWidget";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { JsonLd } from "@/components/JsonLd";
import { Providers } from "@/components/Providers";
import { absoluteUrl } from "@/lib/seo";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(absoluteUrl("/")),
  title: {
    default: "Redline Labs | Research chemicals, Australia",
    template: "%s | Redline Labs",
  },
  description:
    "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
  icons: {
    icon: "/brand/icon.jpeg",
    apple: "/brand/icon.jpeg",
  },
  openGraph: {
    type: "website",
    locale: "en_AU",
    siteName: "Redline Labs",
    title: "Redline Labs | Research chemicals, Australia",
    description:
      "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Redline Labs | Research chemicals, Australia",
    description:
      "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
  },
};

export const viewport: Viewport = {
  themeColor: "#050505",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#050505] font-sans text-[#f3f1ea]">
        <JsonLd
          data={[
            {
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "Redline Labs",
              url: absoluteUrl("/"),
              email: "redlinelabsltd@pm.me",
              description:
                "Laboratory research chemicals shipped within Australia. For laboratory research use only.",
            },
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "Redline Labs",
              url: absoluteUrl("/"),
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
      </body>
    </html>
  );
}
