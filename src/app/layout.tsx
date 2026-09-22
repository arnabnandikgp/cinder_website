import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { site } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: site.url ? new URL(site.url) : undefined,
  title: "Cinder — One private account for Solana perps",
  description: site.description,
  applicationName: "Cinder",
  openGraph: {
    title: "Cinder — One private account for Solana perps",
    description: site.description,
    type: "website",
    siteName: "Cinder",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Cinder — One private account for Solana perps",
    description: site.description,
  },
  icons: { icon: "/favicon.ico", apple: "/apple-touch-icon.png" },
  ...(site.url ? { alternates: { canonical: site.url } } : {}),
};

export const viewport: Viewport = { themeColor: "#0B0B0B" };

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
