// app/faq/page.tsx
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { FaqSection } from "@/components/home/FaqSection";
import type { FaqItem } from "@/lib/home/get-faqs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Frequently Asked Questions — Siargao Ferry & Tours | Travela Siargao",
  description: "Everything you need to know about booking ferry tickets to Siargao, island tours, luggage, payment via GCash, and travel tips for Siargao Island, Philippines.",
  keywords: [
    "siargao ferry FAQ", "how to get to siargao", "siargao ferry price",
    "siargao travel tips", "surigao to siargao ferry", "siargao island hopping cost",
    "gcash ferry booking siargao", "siargao travel guide 2026",
  ],
  openGraph: {
    title: "Siargao Travel FAQ — Travela Siargao",
    description: "Answers to the most common questions about getting to Siargao, booking ferry tickets, island tours, and travel tips.",
    url: "https://www.travelasiargao.com/faq",
    siteName: "Travela Siargao",
    type: "website",
  },
  alternates: {
    canonical: "https://www.travelasiargao.com/faq",
  },
};

async function getFaqs(): Promise<FaqItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("faqs")
    .select("id, question, answer, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as FaqItem[];
}

export default async function FaqPage() {
  const faqs = await getFaqs();

  // ── JSON-LD FAQPage schema for Google featured snippets + voice search ────
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map((faq) => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#085C52 0%,#0c7b93 100%)", padding: "48px 24px 40px" }}>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 8 }}>
            Help center
          </p>
          <h1 className="font-black text-white" style={{ fontSize: "clamp(26px,5vw,42px)", lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 10 }}>
            Frequently asked questions
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", fontWeight: 500, maxWidth: 520 }}>
            Everything you need to know before you sail to Siargao Island.
          </p>

          {/* Quick links */}
          <div className="flex flex-wrap gap-2 mt-5">
            {["Ferry booking", "Payment & GCash", "Luggage", "Discounts", "Weather cancellation"].map((topic) => (
              <span key={topic} style={{
                background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)",
                color: "white", fontSize: 12, fontWeight: 600, padding: "5px 14px", borderRadius: 999,
              }}>
                {topic}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ accordion — reuses your existing FaqSection component */}
      <FaqSection faqs={faqs} />

      {/* Still have questions CTA */}
      <section className="bg-white py-10 border-t border-teal-100">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl text-center" style={{ background: "linear-gradient(135deg,#085C52 0%,#0c7b93 50%,#1AB5A3 100%)", padding: "36px 24px" }}>
            <p style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 8 }}>
              Still have questions?
            </p>
            <h2 className="font-black text-white" style={{ fontSize: 22, letterSpacing: "-0.02em", marginBottom: 8 }}>
              Ready to book your trip to Siargao? 🌊
            </h2>
            <p style={{ color: "rgba(255,255,255,0.62)", fontSize: 13, fontWeight: 500, marginBottom: 22 }}>
              Book your ferry online in 2 minutes — pay via GCash, get your QR ticket instantly.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/book" className="inline-flex items-center justify-center gap-2 font-extrabold hover:-translate-y-0.5 transition-all"
                style={{ background: "white", color: "#085C52", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>
                🚢 Book a Ferry
              </a>
              <a href="/tours" className="inline-flex items-center justify-center gap-2 font-bold hover:-translate-y-0.5 transition-all"
                style={{ background: "rgba(255,255,255,0.1)", border: "2px solid rgba(255,255,255,0.25)", color: "white", padding: "12px 28px", borderRadius: 14, fontSize: 14, textDecoration: "none" }}>
                🌴 Browse Tours
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
