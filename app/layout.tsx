import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { themeInitScript } from "@/lib/theme";
import "./globals.css";

// Auto-hébergées : seules les graisses utilisées (Regular, Medium, SemiBold)
// sont préchargées, avec font-display: swap — cf. charte graphique v1.0.
const geistSans = localFont({
  variable: "--font-geist-sans",
  display: "swap",
  src: [
    { path: "./fonts/geist-sans/Geist-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist-sans/Geist-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist-sans/Geist-SemiBold.ttf", weight: "600", style: "normal" },
  ],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  display: "swap",
  src: [
    { path: "./fonts/geist-mono/GeistMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/geist-mono/GeistMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "./fonts/geist-mono/GeistMono-SemiBold.ttf", weight: "600", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "Tacynt Shop",
  description: "SaaS multi-tenant de gestion de boutique",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInitScript}
        </Script>
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
