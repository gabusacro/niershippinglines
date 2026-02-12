import type { Metadata, Viewport } from "next";
import { Nunito } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ExtensionFriendlyHandlers } from "@/components/ExtensionFriendlyHandlers";
import { ActionToastProvider } from "@/components/ui/ActionToast";
import { APP_NAME } from "@/lib/constants";

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const siteDescription =
  "Book ferry tickets from Siargao to Surigao, Dinagat to Surigao. Schedules, weather & attractions. Nier Shipping Lines.";

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_APP_URL ? new URL(process.env.NEXT_PUBLIC_APP_URL) : undefined,
  title: { default: APP_NAME, template: `%s | ${APP_NAME}` },
  description: siteDescription,
  keywords: ["ferry", "Siargao", "Surigao", "Dinagat", "boat", "tickets", "schedule", "Nier Shipping Lines", "Philippines"],
  openGraph: { title: APP_NAME, description: siteDescription, type: "website", locale: "en_PH" },
  twitter: { card: "summary_large_image", title: APP_NAME, description: siteDescription },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  alternates: { canonical: process.env.NEXT_PUBLIC_APP_URL ?? undefined },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#0c7b93",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={nunito.variable} data-scroll-behavior="smooth">
      <body className="min-h-screen min-h-[100dvh] antialiased flex flex-col font-sans bg-[#fef9e7] text-[#134e4a] safe-area-pad overflow-x-hidden selection:bg-[#0c7b93]/20 selection:text-[#134e4a]" suppressHydrationWarning>
        <ActionToastProvider>
          <ExtensionFriendlyHandlers />
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </ActionToastProvider>
      </body>
    </html>
  );
}
