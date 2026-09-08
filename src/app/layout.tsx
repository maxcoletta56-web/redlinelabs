import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Providers } from "@/components/Providers";
import "./globals.css";

const sans = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Redline Labs | Research peptides Australia",
    template: "%s | Redline Labs",
  },
  description:
    "Ultra-pure, lab-verified research peptides, shipped Australia-wide.",
  icons: {
    icon: "/brand/icon.jpeg",
    apple: "/brand/icon.jpeg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-[#050505] font-sans text-[#f4f4f4]">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
