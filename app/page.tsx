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

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const today = getTodayInManila();

  const [branding, discoverItems, schedule, announcements, faqs, fees] = await Promise.all([
    getSiteBranding(),
    getDiscoverItems(),
    getScheduleFromSupabase(),
    getActiveAnnouncements(),
    getFaqs(),
    getFeeSettings(),
  ]);

  return (
    <div className="min-h-[calc(100vh-8rem)]">

      {/* ① HERO */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#0d9488]/25 via-[#99d6d4]/15 to-transparent pt-8 pb-10 sm:pt-14 sm:pb-14">
        <div className="absolute inset-0 flex justify-between pointer-events-none opacity-20">
          <PalmTree size={56} className="text-[#0f766e] -ml-2 mt-16 rotate-12 sm:w-16 sm:h-16 md:w-20 md:h-20 md:mt-20" />
          <Sun size={48} className="text-[#f59e0b] mr-4 mt-6 sm:w-14 sm:h-14 md:w-16 md:h-16 md:mr-8 md:mt-8" />
          <Wave size={56} className="text-[#0c7b93] mr-4 mt-32 sm:w-16 sm:h-16 md:w-[72px] md:h-[72px] md:mr-16 md:mt-40" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="inline-block rounded-full border border-[#0c7b93]/20 bg-[#0c7b93]/10 px-4 py-1 text-xs font-extrabold uppercase tracking-widest text-[#0c7b93] mb-4">
            🚢 Daily ferry · Siargao · Surigao · Dinagat
          </span>
          <h1 className="text-3xl font-black text-[#134e4a] leading-tight tracking-tight sm:text-4xl md:text-5xl">
            {branding.site_name}
          </h1>
          <p className="mt-3 text-base text-[#0f766e] font-bold tracking-tight sm:mt-4 sm:text-lg">
            {branding.routes_text}
          </p>
          <p className="mt-2 text-[#0f766e]/90 text-base font-semibold sm:mt-3 sm:text-lg">
            {branding.tagline}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <Link href={ROUTES.book}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0c7b93] px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-[#0c7b93]/25 hover:bg-[#0f766e] transition-all duration-200 active:scale-[0.98]">
              <Boat size={20} /> Book a Trip
            </Link>
            <a href="#schedule"
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-4 text-base font-extrabold text-[#134e4a] shadow-lg shadow-[#f59e0b]/25 hover:bg-[#fbbf24] transition-all duration-200 active:scale-[0.98]">
              <Sun size={20} /> View Schedule
            </a>
          </div>

          {/* Quick trip checker */}
          <TripCheckerForm
            routes={schedule.map((r) => ({
              routeId: r.routeId,
              routeOrigin: r.routeOrigin,
              routeDestination: r.routeDestination,
            }))}
            today={today}
          />

        </div>
      </section>

      {/* ② SCHEDULE — from Supabase, replaces /schedule page */}
      <ScheduleSectionClient schedule={schedule} announcements={announcements} today={today} />

      {/* ③ HOW IT WORKS */}
      <section className="border-t border-teal-200/50 bg-[#fef9e7]/60 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93]">Simple process</p>
          <h2 className="mt-1 text-2xl font-black text-[#134e4a] sm:text-3xl">Book in 3 easy steps</h2>
          <p className="mt-1 text-sm font-semibold text-[#0f766e]">No queuing. Book from anywhere, anytime.</p>

          <div className="mt-8 grid gap-0 sm:grid-cols-3">
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
                <p className="mt-1 text-sm font-semibold text-[#0f766e]">{step.desc}</p>
                {i < 2 && <span className="absolute right-0 top-1/2 -translate-y-1/2 text-2xl text-teal-200 font-bold hidden sm:block">→</span>}
              </div>
            ))}
          </div>

          {/* Print ticket notice */}
          <div className="mt-6 flex gap-3 rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
            <span className="text-xl shrink-0">🖨️</span>
            <div>
              <p className="font-extrabold text-amber-900 text-sm">Print or save your ticket before going to the pier</p>
              <p className="mt-1 text-xs font-semibold text-amber-800 leading-relaxed">
                Your QR code e-ticket will be scanned at boarding. You can print it or show on your phone.
                Note: a separate <strong>gate pass fee</strong> is collected at the port and is <strong>not included</strong> in your ferry fare.
              </p>
            </div>
          </div>

          {/* Discounts */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-[#f59e0b] to-[#fbbf24] px-5 py-4">
            <div>
              <h3 className="font-black text-[#134e4a] text-lg">Discounts for all ages</h3>
              <p className="text-sm font-semibold text-[#134e4a]/70 mt-0.5">Senior, PWD, student & child fares — bring valid ID</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">👴 Senior -{fees.senior_discount_percent}%</span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">♿ PWD -{fees.pwd_discount_percent}%</span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">👶 Infants free</span>
                <span className="rounded-full bg-[#134e4a]/10 px-3 py-0.5 text-xs font-extrabold text-[#134e4a]">🎒 Kids -{fees.child_discount_percent}%</span>
              </div>
            </div>
            <Link href={ROUTES.book}
              className="rounded-xl bg-[#085C52] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#0c7b93] whitespace-nowrap">
              Book now →
            </Link>
          </div>
        </div>
      </section>

      {/* ④ WEATHER */}
      <section className="border-t border-teal-200/50 bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-extrabold uppercase tracking-widest text-[#0c7b93] mb-1">Live conditions · Siargao</p>
          <h2 className="text-xl font-black text-[#134e4a] mb-4">Today&apos;s weather</h2>
          <div className="max-w-4xl">
            <WeatherWidget />
          </div>
          <p className="mt-3 text-sm font-semibold text-[#0f766e]">
            <Link href={ROUTES.weather} className="font-extrabold text-[#0c7b93] hover:underline">Full weather forecast →</Link>
          </p>
        </div>
      </section>

      {/* ⑤ DISCOVER SIARGAO */}
      <DiscoverSiargaoPublic items={discoverItems} />

      {/* ⑥ FAQ */}
      <FaqSection faqs={faqs} />

      {/* ⑦ FOOTER CTA */}
      <section className="border-t border-teal-200/50 bg-[#fef9e7]/60 py-10 sm:py-14">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-10 text-center text-white shadow-lg">
            <h2 className="text-2xl font-black sm:text-3xl">Ready to sail to Siargao? 🌊</h2>
            <p className="mt-2 text-white/75 font-semibold">Book your ferry in 2 minutes. Safe, reliable, hassle-free.</p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link href={ROUTES.book}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-extrabold text-[#085C52] shadow-md transition-all hover:bg-[#fef9e7] hover:-translate-y-0.5">
                🚢 Book a Trip
              </Link>
              <a href="#schedule"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 text-base font-extrabold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5">
                🗓 See Schedule
              </a>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
