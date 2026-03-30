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
  Clock,
  Compass,
  ArrowRight,
  MapPin,
  Waves,
  Camera,
  Star,
  ParkingCircle,
  Shield,
  CheckCircle,
  Navigation,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Travela Siargao | Ferry Booking — Siargao Island to Surigao City",
  description:
    "Book your ferry to Siargao Island online. Daily trips from Surigao City to Dapa, Siargao and Dinagat. Real-time seat availability, GCash payment, instant e-ticket. Senior, PWD & student discounts.",
  keywords: [
    "siargao island", "siargao ferry", "surigao to siargao", "siargao boat",
    "dapa siargao ferry", "siargao island travel", "general luna siargao",
    "siargao philippines", "siargao island hopping", "manila to siargao",
    "siargao beach", "cloud 9 siargao", "naked island siargao",
    "ferry booking siargao", "siargao island ferry schedule",
  ],
  openGraph: {
    title: "Travela Siargao | Ferry Booking — Siargao Island",
    description: "Daily ferry trips to Siargao Island. Book online in 2 minutes, pay ONLINE, get instant e-ticket.",
    url: "https://www.travelasiargao.com",
    siteName: "Travela Siargao",
    type: "website",
    locale: "en_PH",
    images: [{
      url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png",
      width: 1200, height: 630,
      alt: "Travela Siargao – Ferry Booking to Siargao Island",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Travela Siargao | Ferry Booking",
    description: "Book your ferry to Siargao Island. Daily trips, real-time seats, ONLINE payment.",
    images: ["https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png"],
  },
  alternates: { canonical: "https://www.travelasiargao.com" },
};

export const dynamic = "force-dynamic";

const BG2 = "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/discover-media/travelasiargao%20(2).webp";

export default async function HomePage() {
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
          ① HERO — original background image
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative min-h-screen flex flex-col justify-end overflow-hidden">
        <div
          className="absolute inset-0 scale-110 will-change-transform"
          id="heroBg"
          style={{
            backgroundImage: "url('https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Discover%20Siargao%20Contents/background%20travela%20siargao.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundColor: "#0d4a45",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0d4a45]/40 via-[#085C52]/20 to-[#0d1f1a]/98" />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]" aria-hidden="true">
          {[
            { w: 5, l: 12, d: 9, delay: 0 }, { w: 4, l: 78, d: 12, delay: 2.5 },
            { w: 7, l: 45, d: 8, delay: 1 }, { w: 3, l: 62, d: 13, delay: 4 },
            { w: 6, l: 28, d: 10, delay: 3 }, { w: 4, l: 88, d: 11, delay: 6 },
            { w: 5, l: 55, d: 7, delay: 2 }, { w: 3, l: 35, d: 14, delay: 5 },
          ].map((p, i) => (
            <span key={i} className="absolute rounded-full bg-[#99d6d4]/20"
              style={{ width: p.w, height: p.w, left: `${p.l}%`, animation: `floatUp ${p.d}s linear ${p.delay}s infinite` }} />
          ))}
        </div>

        <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 text-center pt-28 pb-0">
          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-5 animate-[fadeUp_0.8s_ease_0.2s_both]">
            {[
              { icon: <Ship size={10} />, label: "Daily Ferry", highlight: true },
              { icon: <Car size={10} />, label: "Pay Parking" },
              { icon: <Map size={10} />, label: "Travel & Tours" },
              { label: "Siargao Island" },
              { label: "Surigao Del Norte" },
              { label: "Dinagat" },
            ].map((b, i) => (
              <span key={i} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.6rem] font-extrabold uppercase tracking-widest ${b.highlight ? "border border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#fbbf24]" : "border border-white/20 bg-white/8 text-white/80"}`}>
                {b.icon}{b.label}
              </span>
            ))}
          </div>

          <h1 className="font-['Lora',serif] text-[clamp(2.8rem,8vw,5.5rem)] font-semibold text-white leading-[1.05] animate-[fadeUp_0.9s_ease_0.4s_both]">
            {branding.site_name}
          </h1>
          <p className="mt-3 text-[clamp(0.85rem,2vw,1rem)] font-bold text-white/70 tracking-wide animate-[fadeUp_0.8s_ease_0.62s_both]">
            Surigao ↔ Dapa &nbsp;·&nbsp; Siargao ↔ Dinagat &nbsp;·&nbsp; Book in Minutes
          </p>

          <div className="mt-6 flex flex-wrap gap-3 justify-center animate-[fadeUp_0.8s_ease_0.8s_both]">
            <Link href={ROUTES.book}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0c7b93] px-6 py-3.5 text-base font-extrabold text-white shadow-lg shadow-[#0c7b93]/40 hover:bg-[#0f766e] transition-all duration-200 active:scale-[0.98]">
              <Ship size={18} /> Book a Trip
            </Link>
            <a href="#schedule"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-3.5 text-base font-extrabold text-[#134e4a] shadow-lg shadow-[#f59e0b]/30 hover:bg-[#fbbf24] transition-all duration-200 active:scale-[0.98]">
              <Calendar size={18} /> View Schedule
            </a>
          </div>

          <div className="mt-6 animate-[fadeUp_0.8s_ease_1s_both]">
            <TripCheckerForm
              routes={schedule.flatMap((v) => v.trips.map((t) => ({ routeId: t.routeId, routeOrigin: t.routeOrigin, routeDestination: t.routeDestination }))).filter((r, i, arr) => arr.findIndex((x) => x.routeId === r.routeId) === i)}
              today={today}
            />
          </div>
        </div>

        {/* Bottom of hero fades into BG2 — no white wave */}
        <div className="relative z-10 mt-10 leading-[0]">
          <svg viewBox="0 0 1440 90" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0,45 C180,90 360,0 540,45 C720,90 900,10 1080,50 C1260,88 1380,20 1440,45 L1440,90 L0,90 Z"
              fill="rgba(10,25,20,0.95)" />
          </svg>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          EVERYTHING BELOW uses BG2 as a single sticky background
         ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative" style={{
        backgroundImage: `url('${BG2}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed",
      }}>
        {/* Single dark overlay over the whole BG2 area */}
        <div className="absolute inset-0 bg-[#071a14]/80 pointer-events-none" />

        {/* ② SCHEDULE */}
        <div className="relative z-10">
          <div className="leading-[0]">
            <svg viewBox="0 0 1440 50" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
              <path d="M0,25 C360,50 720,0 1080,25 C1260,38 1380,10 1440,25 L1440,50 L0,50 Z" fill="rgba(255,255,255,0.06)" />
            </svg>
          </div>

          {/* Schedule wrapper with glass card */}
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-8">
            <div className="rounded-3xl border border-white/10 bg-white/8 backdrop-blur-md overflow-hidden">
              <ScheduleSectionClient schedule={schedule} announcements={announcements} today={today} />
            </div>
          </div>
        </div>

        {/* ③ HOW IT WORKS */}
        <section className="relative z-10 py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">

            <p className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#4dd9c0]">
              <Zap size={13} /> Simple process
            </p>
            <h2 className="mt-1 text-[clamp(1.5rem,3vw,2.1rem)] font-black text-white">
              Book in 3 easy steps
            </h2>
            <p className="mt-1 text-sm font-bold text-white/60">
              No queuing. Book from anywhere, anytime.
            </p>

            <div className="mt-8 grid sm:grid-cols-3 gap-4">
              {[
                { emoji: "🗓️", num: "1", title: "Pick your trip", desc: "Choose route, date & number of passengers" },
                { emoji: "📱", num: "2", title: "Pay via GCash", desc: "Send payment & upload screenshot as proof" },
                { emoji: "🎫", num: "3", title: "Get your e-ticket", desc: "Receive QR code instantly. Show & scan at the pier!" },
              ].map((step, i) => (
                <div key={i} className="relative rounded-2xl border border-white/10 bg-white/8 backdrop-blur-sm text-center px-6 py-6">
                  <div className="text-3xl mb-2">{step.emoji}</div>
                  <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#0c7b93] text-white font-black text-sm">
                    {step.num}
                  </div>
                  <h3 className="font-black text-white">{step.title}</h3>
                  <p className="mt-1 text-sm font-bold text-white/60">{step.desc}</p>
                  {i < 2 && (
                    <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-[#4dd9c0] font-black hidden sm:block z-10">
                      <ArrowRight size={22} />
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm px-5 py-4">
              <Printer size={20} className="text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-extrabold text-amber-300 text-sm">Print or save your ticket before going to the pier</p>
                <p className="mt-1 text-xs font-bold text-amber-200/70 leading-relaxed">
                  Your QR code e-ticket will be scanned at boarding. Note: a separate <strong>gate pass fee</strong> is collected at the port and is <strong>not included</strong> in your ferry fare.
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f59e0b]/30 bg-gradient-to-r from-[#f59e0b]/20 to-[#fbbf24]/10 backdrop-blur-sm px-5 py-4">
              <div>
                <h3 className="font-black text-white text-lg">Discounts for all ages</h3>
                <p className="text-sm font-bold text-white/60 mt-0.5">Senior, PWD, student & child fares — bring valid ID</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-extrabold text-white">👴 Senior -{fees.senior_discount_percent}%</span>
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-extrabold text-white">♿ PWD -{fees.pwd_discount_percent}%</span>
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-extrabold text-white">👶 Infants free</span>
                  <span className="rounded-full bg-white/10 px-3 py-0.5 text-xs font-extrabold text-white">🎒 Kids -{fees.child_discount_percent}%</span>
                </div>
              </div>
              <Link href={ROUTES.book}
                className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-extrabold text-white transition-colors hover:bg-[#0f766e] whitespace-nowrap">
                Book now →
              </Link>
            </div>
          </div>
        </section>

        {/* ④ TRAVEL & TOURS */}
        <section className="relative z-10 py-16 sm:py-24 border-t border-white/8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-3 py-1 mb-4">
                  <Map size={13} className="text-[#fbbf24]" />
                  <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-[#fbbf24]">Travel &amp; Tours</span>
                </div>
                <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black text-white leading-[1.1]">
                  Explore Siargao<br /><span className="text-[#4dd9c0]">Your Way</span>
                </h2>
                <p className="mt-4 text-white/70 font-semibold leading-relaxed text-sm sm:text-base">
                  From the legendary surf breaks of Cloud 9 to the pristine shores of Naked Island —
                  discover Siargao&apos;s best spots with our curated tours and island experiences.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    { icon: Waves,      text: "Island hopping — Naked, Daku & Guyam Islands" },
                    { icon: Camera,     text: "Surfing lessons at Cloud 9" },
                    { icon: Navigation, text: "Magpupungko Rock Pools & Sugba Lagoon" },
                    { icon: Star,       text: "Custom tour packages for groups & families" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4dd9c0]/20 border border-[#4dd9c0]/30 flex items-center justify-center">
                        <item.icon size={14} className="text-[#4dd9c0]" />
                      </div>
                      <span className="text-sm font-semibold text-white/80">{item.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/tours"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-6 py-3 text-sm font-extrabold text-[#134e4a] shadow-lg shadow-[#f59e0b]/20 hover:bg-[#fbbf24] transition-all hover:-translate-y-0.5">
                    <Map size={16} /> Explore Tours
                  </Link>
                  <Link href="/attractions"
                    className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/8 px-6 py-3 text-sm font-extrabold text-white hover:bg-white/15 transition-all hover:-translate-y-0.5">
                    <Camera size={16} /> See Attractions
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { emoji: "🏄", title: "Surfing",        desc: "Cloud 9 & beginner breaks",    color: "from-[#0c7b93]/50 to-[#0c7b93]/20" },
                  { emoji: "🏝️", title: "Island Hopping", desc: "Naked, Daku & Guyam",          color: "from-[#f59e0b]/50 to-[#f59e0b]/20" },
                  { emoji: "🌊", title: "Lagoon Tours",   desc: "Sugba & hidden spots",          color: "from-[#4dd9c0]/30 to-[#4dd9c0]/10" },
                  { emoji: "🐠", title: "Snorkeling",     desc: "Coral reefs & marine life",     color: "from-[#085C52]/60 to-[#085C52]/30" },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl bg-gradient-to-br ${card.color} border border-white/12 backdrop-blur-sm p-4 hover:scale-[1.03] transition-transform cursor-pointer`}>
                    <div className="text-2xl mb-2">{card.emoji}</div>
                    <h3 className="font-black text-white text-sm">{card.title}</h3>
                    <p className="text-xs text-white/60 font-semibold mt-0.5">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ⑤ PAY PARKING */}
        <section className="relative z-10 py-16 sm:py-24 border-t border-white/8">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="grid grid-cols-2 gap-3 order-2 lg:order-1">
                {[
                  { emoji: "🚗", title: "Cars",        desc: "Secure daily parking slots",      color: "from-[#0c7b93]/50 to-[#0c7b93]/20" },
                  { emoji: "🏍️", title: "Motorcycles", desc: "Dedicated bike spaces",           color: "from-[#4dd9c0]/30 to-[#4dd9c0]/10" },
                  { emoji: "🚐", title: "Vans",        desc: "Spacious van parking",            color: "from-[#f59e0b]/50 to-[#f59e0b]/20" },
                  { emoji: "📱", title: "Book Online", desc: "GCash payment, instant slot",     color: "from-[#085C52]/60 to-[#085C52]/30" },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl bg-gradient-to-br ${card.color} border border-white/12 backdrop-blur-sm p-4 hover:scale-[1.03] transition-transform cursor-pointer`}>
                    <div className="text-2xl mb-2">{card.emoji}</div>
                    <h3 className="font-black text-white text-sm">{card.title}</h3>
                    <p className="text-xs text-white/60 font-semibold mt-0.5">{card.desc}</p>
                  </div>
                ))}
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#4dd9c0]/40 bg-[#4dd9c0]/15 px-3 py-1 mb-4">
                  <ParkingCircle size={13} className="text-[#4dd9c0]" />
                  <span className="text-[0.62rem] font-extrabold uppercase tracking-[0.2em] text-[#4dd9c0]">Pay Parking</span>
                </div>
                <h2 className="text-[clamp(1.8rem,4vw,2.8rem)] font-black text-white leading-[1.1]">
                  Worry-Free Parking<br /><span className="text-[#4dd9c0]">Near Dapa Port</span>
                </h2>
                <p className="mt-4 text-white/70 font-semibold leading-relaxed text-sm sm:text-base">
                  Leave your vehicle in a safe, managed parking lot near the port.
                  Book your slot online before you travel — no more last-minute scrambles for parking.
                </p>
                <div className="mt-6 space-y-3">
                  {[
                    { icon: Shield,      text: "Secure, guarded parking lots near Dapa Port" },
                    { icon: CheckCircle, text: "Book your slot online via GCash — confirmed instantly" },
                    { icon: Car,         text: "Cars, motorcycles & vans accommodated" },
                    { icon: Clock,       text: "Flexible daily rates — short or extended stays" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#4dd9c0]/20 border border-[#4dd9c0]/30 flex items-center justify-center">
                        <item.icon size={14} className="text-[#4dd9c0]" />
                      </div>
                      <span className="text-sm font-semibold text-white/80">{item.text}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/parking"
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#4dd9c0] px-6 py-3 text-sm font-extrabold text-[#0a3d35] shadow-lg shadow-[#4dd9c0]/20 hover:bg-[#6ee7d8] transition-all hover:-translate-y-0.5">
                    <ParkingCircle size={16} /> Reserve a Slot
                  </Link>
                  <Link href="/parking"
                    className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/8 px-6 py-3 text-sm font-extrabold text-white hover:bg-white/15 transition-all hover:-translate-y-0.5">
                    <MapPin size={16} /> View Lots &amp; Rates
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ⑥ WEATHER */}
        <section className="relative z-10 border-t border-white/8 py-10 sm:py-12">
          <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
            <p className="flex items-center justify-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#4dd9c0] mb-1">
              <Compass size={13} /> Live conditions · Siargao
            </p>
            <h2 className="text-xl font-black text-white mb-4">Today&apos;s weather</h2>
            <WeatherWidget />
            <p className="mt-3 text-sm font-bold text-white/60">
              <Link href={ROUTES.weather} className="font-extrabold text-[#4dd9c0] hover:underline">
                Full weather forecast →
              </Link>
            </p>
          </div>
        </section>

        {/* Wave into Discover — transitions from BG2 dark to white */}
        <div className="relative z-10 leading-[0]">
          <svg viewBox="0 0 1440 70" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
            <path d="M0,30 C240,70 480,0 720,40 C960,70 1200,10 1440,35 L1440,70 L0,70 Z" fill="white" />
          </svg>
        </div>
      </div>
      {/* End of BG2 wrapper */}

      {/* ⑦ DISCOVER SIARGAO */}
      <div className="bg-white">
        <DiscoverSiargaoPublic items={discoverItems} />
      </div>

      <div className="leading-[0] bg-white">
        <svg viewBox="0 0 1440 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" className="w-full block">
          <path d="M0,20 C300,55 700,0 1000,38 C1200,60 1350,15 1440,30 L1440,60 L0,60 Z" fill="#fef9e7" />
        </svg>
      </div>

      {/* ⑧ FAQ */}
      <div className="bg-[#fef9e7]">
        <FaqSection faqs={faqs} />
      </div>

      {/* ⑨ FOOTER CTA */}
      <section className="bg-[#fef9e7] border-t border-teal-200/40 py-12 sm:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-12 text-center text-white shadow-xl shadow-[#0c7b93]/25">
            <h2 className="text-[clamp(1.6rem,3vw,2.3rem)] font-black">Ready to sail to Siargao? 🌊</h2>
            <p className="mt-2 text-white/70 font-bold">Book your ferry in minutes. Safe, reliable, hassle-free.</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Link href={ROUTES.book}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 text-base font-extrabold text-[#085C52] shadow-md transition-all hover:bg-[#fef9e7] hover:-translate-y-0.5">
                <Ship size={18} /> Book a Trip
              </Link>
              <a href="#schedule"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 text-base font-extrabold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5">
                <Calendar size={18} /> See Schedule
              </a>
            </div>
          </div>
        </div>
      </section>

      <ParallaxScript />
    </div>
  );
}
