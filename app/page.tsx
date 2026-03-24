import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { getSiteBranding } from "@/lib/site-branding";
import { PalmTree, Wave, Sun, Boat } from "@/components/icons";
import { WeatherWidget } from "@/components/weather/WeatherWidget";
import { DiscoverSiargaoPublic } from "@/components/home/DiscoverSiargaoPublic";
import { ScheduleSectionClient } from "@/components/home/ScheduleSectionClient";
import { FaqSection } from "@/components/home/FaqSection";
import { getDiscoverItems } from "@/lib/dashboard/get-discover-items";
import { getScheduleFromSupabase } from "@/lib/schedule/get-schedule";
import { getActiveAnnouncements } from "@/lib/announcements/get-announcements";
import { getFaqs } from "@/lib/home/get-faqs";
import { getTodayInManila } from "@/lib/admin/ph-time";
import { getFeeSettings } from "@/lib/get-fee-settings";
import { TripCheckerForm } from "@/components/home/TripCheckerForm";
import ParallaxScript from "@/components/home/ParallaxScript";
import {
  Ship,
  Calendar,
  Car,
  Map,
  Zap,
  Printer,
  HelpCircle,
  Clock,
  Compass,
  ArrowRight,
} from "lucide-react";

// ─── metadata (unchanged) ────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: "Travela Siargao | Ferry Booking — Siargao Island to Surigao City",
  description:
    "Book your ferry to Siargao Island online. Daily trips from Surigao City to Dapa, Siargao and Dinagat. Real-time seat availability, GCash payment, instant e-ticket. Senior, PWD & student discounts.",
  keywords: [
    "siargao island",
    "siargao ferry",
    "surigao to siargao",
    "siargao boat",
    "dapa siargao ferry",
    "siargao island travel",
    "general luna siargao",
    "siargao philippines",
    "siargao island hopping",
    "manila to siargao",
    "siargao beach",
    "cloud 9 siargao",
    "naked island siargao",
    "ferry booking siargao",
    "siargao island ferry schedule",
  ],
  openGraph: {
    title: "Travela Siargao | Ferry Booking — Siargao Island",
    description:
      "Daily ferry trips to Siargao Island. Book online in 2 minutes, pay ONLINE, get instant e-ticket.",
    url: "https://www.travelasiargao.com",
    siteName: "Travela Siargao",
    type: "website",
    locale: "en_PH",


  images: [                              // 👈 ADD THIS
    {
      url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png",
      width: 1200,
      height: 630,
      alt: "Travela Siargao – Ferry Booking to Siargao Island",
    },
  ],


  },
  twitter: {
    card: "summary_large_image",
    title: "Travela Siargao | Ferry Booking",
    description:
      "Book your ferry to Siargao Island. Daily trips, real-time seats, ONLINE payment.",
        images: ["https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png"],
  },
  alternates: {
    canonical: "https://www.travelasiargao.com",
  },
};

export const dynamic = "force-dynamic";

// ─── page ────────────────────────────────────────────────────────────────────
export default async function HomePage() {
  // ✅ ALL Supabase fetches are untouched
  const today = getTodayInManila();

  const [branding, discoverItems, schedule, announcements, faqs, fees] =
    await Promise.all([
      getSiteBranding(),
      getDiscoverItems(),
      getScheduleFromSupabase(),
      getActiveAnnouncements(),
      getFaqs(),
      getFeeSettings(),
    ]);

  return (
    <div className="min-h-[calc(100vh-8rem)] overflow-x-hidden">

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ① HERO — parallax bg + glass trip-checker
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">

        {/* Parallax background — your Supabase image URL */}
        <div
          className="absolute inset-0 scale-110 will-change-transform"
          id="heroBg"
          style={{
            backgroundImage:
              "url('https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Discover%20Siargao%20Contents/background%20travela%20siargao.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#0d4a45", // fallback if image is slow
          }}
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d4a45]/40 via-[#085C52]/20 to-[#134e4a]/95" />

        {/* Floating particles — purely decorative */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]" aria-hidden="true">
          {[
            { w: 5, l: 12, d: 9, delay: 0 },
            { w: 4, l: 78, d: 12, delay: 2.5 },
            { w: 7, l: 45, d: 8, delay: 1 },
            { w: 3, l: 62, d: 13, delay: 4 },
            { w: 6, l: 28, d: 10, delay: 3 },
            { w: 4, l: 88, d: 11, delay: 6 },
            { w: 5, l: 55, d: 7, delay: 2 },
            { w: 3, l: 35, d: 14, delay: 5 },
          ].map((p, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-[#99d6d4]/20"
              style={{
                width: p.w,
                height: p.w,
                left: `${p.l}%`,
                animation: `floatUp ${p.d}s linear ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 text-center pt-28 pb-0">

          {/* Service badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-5 animate-[fadeUp_0.8s_ease_0.2s_both]">
            <span className="inline-flex items-center gap-1.5 border border-[#f59e0b]/50 bg-[#f59e0b]/10 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-[#fbbf24]">
              <Ship size={10} /> Daily Ferry
            </span>
            <span className="inline-flex items-center gap-1.5 border border-white/20 bg-white/8 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-white/80">
              <Car size={10} /> Pay Parking
            </span>
            <span className="inline-flex items-center gap-1.5 border border-white/20 bg-white/8 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-white/80">
              <Map size={10} /> Travel &amp; Tours
            </span>
            <span className="inline-flex items-center gap-1.5 border border-white/20 bg-white/8 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-white/80">
              Siargao Island
            </span>
            <span className="inline-flex items-center gap-1.5 border border-white/20 bg-white/8 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-white/80">
              Surigao Del Norte
            </span>
            <span className="inline-flex items-center gap-1.5 border border-white/20 bg-white/8 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest text-white/80">
              Dinagat
            </span>
          </div>

          {/* Title — uses branding from Supabase */}
          <h1 className="font-['Lora',serif] text-[clamp(2.8rem,8vw,5.5rem)] font-semibold text-white leading-[1.05] animate-[fadeUp_0.9s_ease_0.4s_both]">
            {branding.site_name}
          </h1>

          {/* Sub — updated copy */}
          <p className="mt-3 text-[clamp(0.85rem,2vw,1rem)] font-bold text-white/70 tracking-wide animate-[fadeUp_0.8s_ease_0.62s_both]">
            Surigao ↔ Dapa &nbsp;·&nbsp; Siargao ↔ Dinagat &nbsp;·&nbsp; Book in Minutes
          </p>

          {/* CTA buttons */}
          <div className="mt-6 flex flex-wrap gap-3 justify-center animate-[fadeUp_0.8s_ease_0.8s_both]">
            <Link
              href={ROUTES.book}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0c7b93] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#0c7b93]/40 hover:bg-[#0f766e] transition-all duration-200 active:scale-[0.98]"
            >
              <Ship size={18} /> Book a Trip
            </Link>
            <a
              href="#schedule"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-3.5 text-base font-extrabold text-[#134e4a] shadow-lg shadow-[#f59e0b]/30 hover:bg-[#fbbf24] transition-all duration-200 active:scale-[0.98]"
            >
              <Calendar size={18} /> View Schedule
            </a>
          </div>

          {/* ✅ TripCheckerForm — your real component, untouched */}
          <div className="mt-6 animate-[fadeUp_0.8s_ease_1s_both]">
            <TripCheckerForm
              routes={schedule
                .flatMap((v) =>
                  v.trips.map((t) => ({
                    routeId: t.routeId,
                    routeOrigin: t.routeOrigin,
                    routeDestination: t.routeDestination,
                  }))
                )
                .filter(
                  (r, i, arr) =>
                    arr.findIndex((x) => x.routeId === r.routeId) === i
                )}
              today={today}
            />
          </div>
        </div>

        {/* Wave transition into cream section */}
        <div className="relative z-10 mt-10 leading-[0]">
          <svg
            viewBox="0 0 1440 90"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full block"
          >
            <path
              d="M0,45 C180,90 360,0 540,45 C720,90 900,10 1080,50 C1260,88 1380,20 1440,45 L1440,90 L0,90 Z"
              fill="#fef9e7"
            />
          </svg>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ② SCHEDULE — your real ScheduleSectionClient
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#fef9e7]">
        {/* Wave into white */}
        <div className="leading-[0]">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0,30 C360,60 720,0 1080,30 C1260,45 1380,15 1440,30 L1440,60 L0,60 Z" fill="white" />
          </svg>
        </div>
        {/* ✅ Real schedule component */}
        <ScheduleSectionClient
          schedule={schedule}
          announcements={announcements}
          today={today}
        />
        {/* Wave back to cream */}
        <div className="leading-[0] bg-white">
          <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0,20 C300,60 600,0 900,35 C1100,55 1300,10 1440,30 L1440,60 L0,60 Z" fill="#fef9e7" />
          </svg>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ③ HOW IT WORKS
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-[#fef9e7] py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">

          <p className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#0c7b93]">
            <Zap size={13} /> Simple process
          </p>
          <h2 className="mt-1 text-[clamp(1.5rem,3vw,2.1rem)] font-black text-[#134e4a]">
            Book in 3 easy steps
          </h2>
          <p className="mt-1 text-sm font-bold text-[#0f766e]">
            No queuing. Book from anywhere, anytime.
          </p>

          {/* Steps */}
          <div className="mt-8 grid sm:grid-cols-3 gap-0">
            {[
              { emoji: "🗓️", num: "1", title: "Pick your trip", desc: "Choose route, date & number of passengers" },
              { emoji: "📱", num: "2", title: "Pay via GCash", desc: "Send payment & upload screenshot as proof" },
              { emoji: "🎫", num: "3", title: "Get your e-ticket", desc: "Receive QR code instantly. Show & scan at the pier!" },
            ].map((step, i) => (
              <div key={i} className="relative text-center px-6 py-6">
                <div className="text-3xl mb-2">{step.emoji}</div>
                <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#0c7b93] text-white font-black text-sm">
                  {step.num}
                </div>
                <h3 className="font-black text-[#134e4a]">{step.title}</h3>
                <p className="mt-1 text-sm font-bold text-[#0f766e]">{step.desc}</p>
                {i < 2 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[#99d6d4] font-black hidden sm:block">
                    <ArrowRight size={22} />
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Print notice */}
          <div className="mt-6 flex gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
            <Printer size={20} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-amber-900 text-sm">
                Print or save your ticket before going to the pier
              </p>
              <p className="mt-1 text-xs font-bold text-amber-800 leading-relaxed">
                Your QR code e-ticket will be scanned at boarding. You can print it or show on
                your phone. Note: a separate{" "}
                <strong>gate pass fee</strong> is collected at the port and is{" "}
                <strong>not included</strong> in your ferry fare.
              </p>
            </div>
          </div>

          {/* Discounts — uses real fee data from Supabase */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] px-5 py-4">
            <div>
              <h3 className="font-black text-[#134e4a] text-lg">Discounts for all ages</h3>
              <p className="text-sm font-bold text-[#134e4a]/70 mt-0.5">
                Senior, PWD, student & child fares — bring valid ID
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">
                  👴 Senior -{fees.senior_discount_percent}%
                </span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">
                  ♿ PWD -{fees.pwd_discount_percent}%
                </span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">
                  👶 Infants free
                </span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">
                  🎒 Kids -{fees.child_discount_percent}%
                </span>
              </div>
            </div>
            <Link
              href={ROUTES.book}
              className="rounded-xl bg-[#085C52] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#0c7b93] whitespace-nowrap"
            >
              Book now →
            </Link>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ④ WEATHER — your real WeatherWidget
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-[#fef9e7] border-t border-teal-200/40 py-10 sm:py-12">
        <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#0c7b93] mb-1">
            <Compass size={13} /> Live conditions · Siargao
          </p>
          <h2 className="text-xl font-black text-[#134e4a] mb-4">
            Today&apos;s weather
          </h2>
          {/* ✅ Real weather widget */}
          <WeatherWidget />
          <p className="mt-3 text-sm font-bold text-[#0f766e]">
            <Link
              href={ROUTES.weather}
              className="font-extrabold text-[#0c7b93] hover:underline"
            >
              Full weather forecast →
            </Link>
          </p>
        </div>
      </section>

      {/* Wave into discover */}
      <div className="leading-[0] bg-[#fef9e7]">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0,30 C240,0 480,60 720,30 C960,0 1200,55 1440,25 L1440,60 L0,60 Z" fill="white" />
        </svg>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑤ DISCOVER SIARGAO — your real component
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-white">
        {/* ✅ Real discover component */}
        <DiscoverSiargaoPublic items={discoverItems} />
      </div>

      {/* Wave into FAQ */}
      <div className="leading-[0] bg-white">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0,20 C300,55 700,0 1000,38 C1200,60 1350,15 1440,30 L1440,60 L0,60 Z" fill="#fef9e7" />
        </svg>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑥ FAQ — your real FaqSection
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="bg-[#fef9e7]">
        {/* ✅ Real FAQ component */}
        <FaqSection faqs={faqs} />
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ⑦ FOOTER CTA
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-[#fef9e7] border-t border-teal-200/40 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-12 text-center text-white shadow-xl shadow-[#0c7b93]/25">
            <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-black">
              Ready to sail to Siargao? 🌊
            </h2>
            <p className="mt-2 text-white/70 font-bold">
              Book your ferry in minutes. Safe, reliable, hassle-free.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link
                href={ROUTES.book}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-extrabold text-[#085C52] shadow-md transition-all hover:bg-[#fef9e7] hover:-translate-y-0.5"
              >
                <Ship size={18} /> Book a Trip
              </Link>
              <a
                href="#schedule"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 text-base font-extrabold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5"
              >
                <Calendar size={18} /> See Schedule
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Parallax scroll script — purely visual, no data involvement */}
      
      <ParallaxScript />
    </div>
  );
}
