import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ExtensionFriendlyHandlers } from "@/components/ExtensionFriendlyHandlers";
import { ActionToastProvider } from "@/components/ui/ActionToast";
import { getSiteBranding } from "@/lib/site-branding";
import Script from "next/script";
import PromoPopup from "@/components/PromoPopup";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getSiteBranding();
  const siteDescription = `Book ferry tickets from Siargao to Surigao, Dinagat to Surigao. Schedules, weather & attractions. ${branding.site_name}.`;
  return {
    metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
    title: { default: branding.site_name, template: `%s | ${branding.site_name}` },
    description: siteDescription,
    icons: { icon: "/favicon.png" },
    keywords: ["ferry", "Siargao", "Surigao", "Dinagat", "boat", "tickets", "schedule", branding.site_name, "Philippines"],
    openGraph: { title: branding.site_name, description: siteDescription, type: "website", locale: "en_PH" },
    twitter: { card: "summary_large_image", title: branding.site_name, description: siteDescription },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
    alternates: { canonical: process.env.NEXT_PUBLIC_APP_URL ?? undefined },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c7b93",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getSiteBranding();
  return (
    <html lang="en" className={nunito.variable} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        {/* Google AdSense — plain script tag to avoid Next.js data-nscript conflict */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4184474089882330"
          crossOrigin="anonymous"
        />
      </head>
      <body className="min-h-screen min-h-[100dvh] antialiased flex flex-col font-sans bg-[#fef9e7] text-[#134e4a] safe-area-pad overflow-x-hidden selection:bg-[#0c7b93]/20 selection:text-[#134e4a]" suppressHydrationWarning>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-0FWWPS478B" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">{`window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-0FWWPS478B');`}</Script>
        <ActionToastProvider>
          <ExtensionFriendlyHandlers />
          <Header siteName={branding.site_name} />
          <main className="flex-1">{children}</main>
          <Footer siteName={branding.site_name} />
          <PromoPopup />
        </ActionToastProvider>
      </body>
    </html>
  );
}
