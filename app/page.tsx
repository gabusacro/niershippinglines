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
  Ship, Calendar, Car, Map, Zap, Printer, Clock, Compass, ArrowRight,
  MapPin, Waves, Camera, Star, ParkingCircle, Shield, CheckCircle, Navigation,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Travela Siargao | Ferry Booking — Siargao Island to Surigao City",
  description: "Book your ferry to Siargao Island online. Daily trips from Surigao City to Dapa, Siargao and Dinagat. Real-time seat availability, GCash payment, instant e-ticket. Senior, PWD & student discounts.",
  keywords: ["siargao island","siargao ferry","surigao to siargao","siargao boat","dapa siargao ferry","siargao island travel","general luna siargao","siargao philippines","siargao island hopping","manila to siargao","siargao beach","cloud 9 siargao","naked island siargao","ferry booking siargao","siargao island ferry schedule"],
  openGraph: {
    title: "Travela Siargao | Ferry Booking — Siargao Island",
    description: "Daily ferry trips to Siargao Island. Book online in 2 minutes, pay ONLINE, get instant e-ticket.",
    url: "https://www.travelasiargao.com", siteName: "Travela Siargao", type: "website", locale: "en_PH",
    images: [{ url: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png", width: 1200, height: 630, alt: "Travela Siargao" }],
  },
  twitter: { card: "summary_large_image", title: "Travela Siargao | Ferry Booking", description: "Book your ferry to Siargao Island.", images: ["https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png"] },
  alternates: { canonical: "https://www.travelasiargao.com" },
};

export const dynamic = "force-dynamic";

const HERO_BG = "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/Discover%20Siargao%20Contents/background%20travela%20siargao.jpg";
const BG2 = "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/discover-media/travelasiargao%20(2).webp";


const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://www.travelasiargao.com/#organization",
      name: "Travela Siargao",
      url: "https://www.travelasiargao.com",
      logo: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/promo-media/promo-popup/banner-1773400190201.png",
      sameAs: [
        "https://www.facebook.com/travelasiargao"
      ]
    },
    {
      "@type": "WebSite",
      "@id": "https://www.travelasiargao.com/#website",
      url: "https://www.travelasiargao.com",
      name: "Travela Siargao",
      publisher: {
        "@id": "https://www.travelasiargao.com/#organization"
      },
      potentialAction: {
        "@type": "SearchAction",
        target: "https://www.travelasiargao.com/search?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    },
{
  "@type": "TravelAgency",
  "@id": "https://www.travelasiargao.com/#travelagency",
  name: "Travela Siargao",
  url: "https://www.travelasiargao.com",
  image: "https://gohrllugnblfzsypapee.supabase.co/storage/v1/object/public/logo/01.png",
  description: "Online ferry booking, tours, and parking reservations for Siargao Island, Surigao City, and Dinagat.",
  telephone: "+63 950 277 8440",
  email: "support@travelasiargao.com",
  priceRange: "₱650 - ₱7,500",
  currenciesAccepted: "PHP",
  paymentAccepted: "Cash, GCash",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Borromeo Street, Brgy. Taft, Surigao City",
    addressLocality: "Surigao - Siargao",
    addressRegion: "Surigao del Norte",
    postalCode: "8400",
    addressCountry: {
      "@type": "Country",
      name: "PH"
    }
  },
  sameAs: [
    "https://www.facebook.com/travelasiargao",
    "https://www.instagram.com/travelasiargao"
  ],
  areaServed: [
    {
      "@type": "Place",
      name: "Siargao Island",
      address: {
        "@type": "PostalAddress",
        addressRegion: "Surigao del Norte",
        postalCode: "8419",
        addressCountry: {
          "@type": "Country",
          name: "PH"
        }
      }
    },
    {
      "@type": "Place",
      name: "Surigao City"
    },
    {
      "@type": "Place",
      name: "Dinagat Islands"
    }
  ],
  serviceType: [
    "Ferry Booking",
    "Travel and Tours",
    "Parking Reservation"
  ]
},
    {
      "@type": "Service",
      "@id": "https://www.travelasiargao.com/#ferrybooking",
      name: "Siargao Ferry Booking",
      provider: {
        "@id": "https://www.travelasiargao.com/#travelagency"
      },
      areaServed: [
        { "@type": "Place", name: "Surigao City" },
        { "@type": "Place", name: "Dapa, Siargao" },
        { "@type": "Place", name: "Dinagat Islands" }
      ],
      description: "Book ferry trips online from Surigao City to Dapa, Siargao and Dinagat with e-ticket and real-time seat availability."
    },
    {
      "@type": "Service",
      "@id": "https://www.travelasiargao.com/#parking",
      name: "Port Parking Reservation",
      provider: {
        "@id": "https://www.travelasiargao.com/#travelagency"
      },
      areaServed: {
        "@type": "Place",
        name: "Dapa Port, Siargao"
      },
      description: "Reserve parking slots near Dapa Port for cars, motorcycles, and vans."
    }
  ]
};





export default async function HomePage() {
  const today = getTodayInManila();
  const [branding, discoverItems, schedule, announcements, faqs, fees] = await Promise.all([
    getSiteBranding(), getDiscoverItems(), getScheduleFromSupabase(),
    getActiveAnnouncements(), getFaqs(), getFeeSettings(),
  ]);

return (
  <div className="overflow-x-hidden">
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />

      {/* ══════════════════════════════════════════════
          ① HERO — own background, vertically centered
         ══════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center overflow-hidden"
        style={{ minHeight: "100svh" }}>

        {/* Hero background */}
        <div className="absolute inset-0" id="heroBg"
          style={{
            backgroundImage: `url('${HERO_BG}')`,
            backgroundSize: "cover",
            backgroundPosition: "center top",
            backgroundColor: "#0d4a45",
          }}
        />

        {/* Overlay — darkens toward bottom so it bleeds into BG2 */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, rgba(13,74,69,0.30) 0%, rgba(8,60,50,0.50) 50%, rgba(3,12,9,1) 100%)" }}
        />

        {/* Floating particles */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-[2]" aria-hidden="true">
          {[{w:5,l:12,d:9,delay:0},{w:4,l:78,d:12,delay:2.5},{w:7,l:45,d:8,delay:1},{w:3,l:62,d:13,delay:4},{w:6,l:28,d:10,delay:3},{w:4,l:88,d:11,delay:6}].map((p,i) => (
            <span key={i} className="absolute rounded-full bg-[#99d6d4]/20"
              style={{ width: p.w, height: p.w, left: `${p.l}%`, animation: `floatUp ${p.d}s linear ${p.delay}s infinite` }} />
          ))}
        </div>

        {/* Hero content — centered vertically and horizontally */}
        <div className="relative z-10 w-full max-w-2xl mx-auto px-5 text-center py-8">

          {/* Badges */}
          <div className="flex flex-wrap justify-center gap-1.5 mb-4">
            {[
              { icon: <Ship size={9}/>, label: "Daily Ferry", highlight: true },
              { icon: <Car size={9}/>, label: "Pay Parking" },
              { icon: <Map size={9}/>, label: "Travel & Tours" },
              { label: "Siargao Island" },
              { label: "Surigao Del Norte" },
              { label: "Dinagat" },
            ].map((b, i) => (
              <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.55rem] font-extrabold uppercase tracking-widest ${b.highlight ? "border border-[#f59e0b]/50 bg-[#f59e0b]/10 text-[#fbbf24]" : "border border-white/20 bg-white/8 text-white/75"}`}>
                {b.icon}{b.label}
              </span>
            ))}
          </div>

          {/* Title */}
          <h1 className="font-['Lora',serif] font-semibold text-white leading-[1.05]"
            style={{ fontSize: "clamp(2.2rem,9vw,5.5rem)" }}>
            {branding.site_name}
          </h1>

          {/* Subtitle */}
          <p className="mt-2 font-bold text-white/65 tracking-wide"
            style={{ fontSize: "clamp(0.75rem,2.5vw,1rem)" }}>
            Surigao ↔ Dapa &nbsp;·&nbsp; Siargao ↔ Dinagat &nbsp;·&nbsp; Book in Minutes
          </p>

          {/* CTA buttons */}
          <div className="mt-5 flex flex-wrap gap-2.5 justify-center">
            <Link href={ROUTES.book}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#0c7b93] px-5 py-3 font-extrabold text-white shadow-lg shadow-[#0c7b93]/40 hover:bg-[#0f766e] transition-all active:scale-[0.97]"
              style={{ fontSize: "clamp(0.8rem,2.5vw,1rem)" }}>
              <Ship size={16}/> Book a Trip
            </Link>
            <a href="#schedule"
              className="inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-5 py-3 font-extrabold text-[#134e4a] shadow-lg shadow-[#f59e0b]/30 hover:bg-[#fbbf24] transition-all active:scale-[0.97]"
              style={{ fontSize: "clamp(0.8rem,2.5vw,1rem)" }}>
              <Calendar size={16}/> View Schedule
            </a>
          </div>

          {/* Trip checker */}
          <div className="mt-5">
            <TripCheckerForm
              routes={schedule.flatMap(v => v.trips.map(t => ({ routeId: t.routeId, routeOrigin: t.routeOrigin, routeDestination: t.routeDestination }))).filter((r,i,arr) => arr.findIndex(x => x.routeId === r.routeId) === i)}
              today={today}
            />
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════
          BG2 COVERS EVERYTHING FROM HERE ALL THE WAY TO THE BOTTOM
          Schedule → How it Works → Tours → Parking → Weather
          → Discover Siargao → FAQ → Footer CTA
         ══════════════════════════════════════════════════════════════ */}
      <div
        style={{
          backgroundImage: `url('${BG2}')`,
          backgroundSize: "cover",
          backgroundPosition: "center top",
          backgroundAttachment: "fixed",
        }}
      >
        {/* Single dark overlay over entire BG2 area */}
        <div style={{ background: "rgba(4,14,10,0.83)" }}>

          {/* ② SCHEDULE */}
          <div className="mx-auto max-w-5xl px-4 sm:px-6 pt-10 pb-8" id="schedule">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl"
              style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(14px)" }}>
              <ScheduleSectionClient schedule={schedule} announcements={announcements} today={today} />
            </div>
          </div>

          {/* ③ HOW IT WORKS */}
          <section className="py-12 sm:py-16 border-t border-white/8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <p className="flex items-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#4dd9c0]">
                <Zap size={13}/> Simple process
              </p>
              <h2 className="mt-1 font-black text-white" style={{ fontSize: "clamp(1.4rem,3vw,2.1rem)" }}>
                Book in 3 easy steps
              </h2>
              <p className="mt-1 text-sm font-bold text-white/50">No queuing. Book from anywhere, anytime.</p>

              <div className="mt-8 grid sm:grid-cols-3 gap-4">
                {[
                  { emoji:"🗓️", num:"1", title:"Pick your trip",    desc:"Choose route, date & number of passengers" },
                  { emoji:"📱", num:"2", title:"Pay via GCash",     desc:"Send payment & upload screenshot as proof" },
                  { emoji:"🎫", num:"3", title:"Get your e-ticket", desc:"Receive QR code instantly. Show & scan at the pier!" },
                ].map((step, i) => (
                  <div key={i} className="relative rounded-2xl border border-white/10 text-center px-5 py-6"
                    style={{ background: "rgba(255,255,255,0.06)", backdropFilter: "blur(10px)" }}>
                    <div className="text-3xl mb-2">{step.emoji}</div>
                    <div className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-[#0c7b93] text-white font-black text-sm">{step.num}</div>
                    <h3 className="font-black text-white text-sm sm:text-base">{step.title}</h3>
                    <p className="mt-1 text-xs sm:text-sm font-bold text-white/55">{step.desc}</p>
                    {i < 2 && <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-[#4dd9c0] hidden sm:block z-10"><ArrowRight size={20}/></span>}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex gap-3 rounded-2xl border border-amber-400/25 px-4 py-4"
                style={{ background: "rgba(245,158,11,0.10)", backdropFilter: "blur(8px)" }}>
                <Printer size={18} className="text-amber-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="font-extrabold text-amber-300 text-sm">Print or save your ticket before going to the pier</p>
                  <p className="mt-1 text-xs font-bold text-amber-200/60 leading-relaxed">
                    Your QR e-ticket is scanned at boarding. A separate <strong>gate pass fee</strong> is collected at the port — <strong>not included</strong> in your ferry fare.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#f59e0b]/25 px-4 py-4"
                style={{ background: "linear-gradient(to right, rgba(245,158,11,0.15), rgba(251,191,36,0.08))", backdropFilter: "blur(8px)" }}>
                <div>
                  <h3 className="font-black text-white text-base sm:text-lg">Discounts for all ages</h3>
                  <p className="text-xs sm:text-sm font-bold text-white/50 mt-0.5">Senior, PWD, student & child fares — bring valid ID</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[`👴 Senior -${fees.senior_discount_percent}%`,`♿ PWD -${fees.pwd_discount_percent}%`,"👶 Infants free",`🎒 Kids -${fees.child_discount_percent}%`].map(t => (
                      <span key={t} className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-extrabold text-white">{t}</span>
                    ))}
                  </div>
                </div>
                <Link href={ROUTES.book} className="rounded-xl bg-[#0c7b93] px-4 py-2.5 text-sm font-extrabold text-white hover:bg-[#0f766e] whitespace-nowrap transition-colors">
                  Book now →
                </Link>
              </div>
            </div>
          </section>

          {/* ④ TRAVEL & TOURS */}
          <section className="py-14 sm:py-20 border-t border-white/8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#f59e0b]/40 bg-[#f59e0b]/15 px-3 py-1 mb-4">
                    <Map size={12} className="text-[#fbbf24]"/>
                    <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#fbbf24]">Travel &amp; Tours</span>
                  </div>
                  <h2 className="font-black text-white leading-[1.1]" style={{ fontSize: "clamp(1.6rem,4vw,2.8rem)" }}>
                    Explore Siargao<br /><span className="text-[#4dd9c0]">Your Way</span>
                  </h2>
                  <p className="mt-3 text-white/65 font-semibold leading-relaxed text-sm sm:text-base">
                    From the legendary surf breaks of Cloud 9 to the pristine shores of Naked Island —
                    discover Siargao&apos;s best spots with our curated tours and island experiences.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    {[
                      { icon: Waves,      text: "Island hopping — Naked, Daku & Guyam Islands" },
                      { icon: Camera,     text: "Surfing lessons at Cloud 9" },
                      { icon: Navigation, text: "Magpupungko Rock Pools & Sugba Lagoon" },
                      { icon: Star,       text: "Custom tour packages for groups & families" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#4dd9c0]/20 border border-[#4dd9c0]/30 flex items-center justify-center">
                          <item.icon size={13} className="text-[#4dd9c0]"/>
                        </div>
                        <span className="text-sm font-semibold text-white/75">{item.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link href="/tours"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#f59e0b] px-5 py-2.5 text-sm font-extrabold text-[#134e4a] hover:bg-[#fbbf24] transition-all hover:-translate-y-0.5">
                      <Map size={15}/> Explore Tours
                    </Link>
                    <Link href="/attractions"
                      className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/8 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-white/15 transition-all hover:-translate-y-0.5">
                      <Camera size={15}/> See Attractions
                    </Link>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { emoji:"🏄", title:"Surfing",        desc:"Cloud 9 & beginner breaks",  color:"from-[#0c7b93]/50 to-[#0c7b93]/20" },
                    { emoji:"🏝️", title:"Island Hopping", desc:"Naked, Daku & Guyam",        color:"from-[#f59e0b]/50 to-[#f59e0b]/20" },
                    { emoji:"🌊", title:"Lagoon Tours",   desc:"Sugba & hidden spots",        color:"from-[#4dd9c0]/30 to-[#4dd9c0]/10" },
                    { emoji:"🐠", title:"Snorkeling",     desc:"Coral reefs & marine life",   color:"from-[#085C52]/60 to-[#085C52]/30" },
                  ].map((card, i) => (
                    <div key={i} className={`rounded-2xl bg-gradient-to-br ${card.color} border border-white/12 p-4 hover:scale-[1.03] transition-transform cursor-pointer`}
                      style={{ backdropFilter: "blur(8px)" }}>
                      <div className="text-xl mb-1.5">{card.emoji}</div>
                      <h3 className="font-black text-white text-sm">{card.title}</h3>
                      <p className="text-xs text-white/55 font-semibold mt-0.5">{card.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ⑤ PAY PARKING */}
          <section className="py-14 sm:py-20 border-t border-white/8">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="grid lg:grid-cols-2 gap-10 items-center">
                <div className="grid grid-cols-2 gap-3 order-2 lg:order-1">
                  {[
                    { emoji:"🚗", title:"Cars",        desc:"Secure daily parking slots",  color:"from-[#0c7b93]/50 to-[#0c7b93]/20" },
                    { emoji:"🏍️", title:"Motorcycles", desc:"Dedicated bike spaces",       color:"from-[#4dd9c0]/30 to-[#4dd9c0]/10" },
                    { emoji:"🚐", title:"Vans",        desc:"Spacious van parking",        color:"from-[#f59e0b]/50 to-[#f59e0b]/20" },
                    { emoji:"📱", title:"Book Online", desc:"GCash payment, instant slot", color:"from-[#085C52]/60 to-[#085C52]/30" },
                  ].map((card, i) => (
                    <div key={i} className={`rounded-2xl bg-gradient-to-br ${card.color} border border-white/12 p-4 hover:scale-[1.03] transition-transform cursor-pointer`}
                      style={{ backdropFilter: "blur(8px)" }}>
                      <div className="text-xl mb-1.5">{card.emoji}</div>
                      <h3 className="font-black text-white text-sm">{card.title}</h3>
                      <p className="text-xs text-white/55 font-semibold mt-0.5">{card.desc}</p>
                    </div>
                  ))}
                </div>
                <div className="order-1 lg:order-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-[#4dd9c0]/40 bg-[#4dd9c0]/15 px-3 py-1 mb-4">
                    <ParkingCircle size={12} className="text-[#4dd9c0]"/>
                    <span className="text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#4dd9c0]">Pay Parking</span>
                  </div>
                  <h2 className="font-black text-white leading-[1.1]" style={{ fontSize: "clamp(1.6rem,4vw,2.8rem)" }}>
                    Worry-Free Parking<br /><span className="text-[#4dd9c0]">Near Dapa Port</span>
                  </h2>
                  <p className="mt-3 text-white/65 font-semibold leading-relaxed text-sm sm:text-base">
                    Leave your vehicle in a safe, managed parking lot near the port.
                    Book your slot online before you travel — no more last-minute scrambles.
                  </p>
                  <div className="mt-5 space-y-2.5">
                    {[
                      { icon: Shield,      text: "Secure, guarded parking lots near Dapa Port" },
                      { icon: CheckCircle, text: "Book your slot online via GCash — confirmed instantly" },
                      { icon: Car,         text: "Cars, motorcycles & vans accommodated" },
                      { icon: Clock,       text: "Flexible daily rates — short or extended stays" },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-[#4dd9c0]/20 border border-[#4dd9c0]/30 flex items-center justify-center">
                          <item.icon size={13} className="text-[#4dd9c0]"/>
                        </div>
                        <span className="text-sm font-semibold text-white/75">{item.text}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link href="/parking"
                      className="inline-flex items-center gap-2 rounded-2xl bg-[#4dd9c0] px-5 py-2.5 text-sm font-extrabold text-[#0a3d35] hover:bg-[#6ee7d8] transition-all hover:-translate-y-0.5">
                      <ParkingCircle size={15}/> Reserve a Slot
                    </Link>
                    <Link href="/parking"
                      className="inline-flex items-center gap-2 rounded-2xl border-2 border-white/20 bg-white/8 px-5 py-2.5 text-sm font-extrabold text-white hover:bg-white/15 transition-all hover:-translate-y-0.5">
                      <MapPin size={15}/> View Lots &amp; Rates
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ⑥ WEATHER */}
          <section className="py-10 sm:py-14 border-t border-white/8">
            <div className="mx-auto max-w-2xl px-4 sm:px-6 text-center">
              <p className="flex items-center justify-center gap-1.5 text-[0.62rem] font-extrabold uppercase tracking-[0.22em] text-[#4dd9c0] mb-1">
                <Compass size={13}/> Live conditions · Siargao
              </p>
              <h2 className="text-xl font-black text-white mb-4">Today&apos;s weather</h2>
              <WeatherWidget />
              <p className="mt-3 text-sm font-bold text-white/50">
                <Link href={ROUTES.weather} className="font-extrabold text-[#4dd9c0] hover:underline">
                  Full weather forecast →
                </Link>
              </p>
            </div>
          </section>

          {/* ⑦ DISCOVER SIARGAO — stays on BG2, component text colours will show on dark */}
          <section className="border-t border-white/8 pt-4">
            <DiscoverSiargaoPublic items={discoverItems} />
          </section>

          {/* ⑧ FAQ — stays on BG2 */}
          <section className="border-t border-white/8">
            <FaqSection faqs={faqs} />
          </section>

          {/* ⑨ FOOTER CTA */}
          <section className="border-t border-white/8 py-12 sm:py-16">
            <div className="mx-auto max-w-5xl px-4 sm:px-6">
              <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-12 text-center text-white shadow-xl shadow-[#0c7b93]/25">
                <h2 className="font-black" style={{ fontSize: "clamp(1.4rem,3vw,2.3rem)" }}>
                  Ready to sail to Siargao? 🌊
                </h2>
                <p className="mt-2 text-white/70 font-bold text-sm sm:text-base">
                  Book your ferry in minutes. Safe, reliable, hassle-free.
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-4">
                  <Link href={ROUTES.book}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-7 py-3.5 font-extrabold text-[#085C52] shadow-md transition-all hover:bg-[#f0fdfa] hover:-translate-y-0.5"
                    style={{ fontSize: "clamp(0.85rem,2vw,1rem)" }}>
                    <Ship size={18}/> Book a Trip
                  </Link>
                  <a href="#schedule"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-white/30 bg-white/10 px-7 py-3.5 font-extrabold text-white backdrop-blur-sm transition-all hover:bg-white/20 hover:-translate-y-0.5"
                    style={{ fontSize: "clamp(0.85rem,2vw,1rem)" }}>
                    <Calendar size={18}/> See Schedule
                  </a>
                </div>
              </div>
            </div>
          </section>

        </div>
      </div>
      {/* BG2 ends here — covers EVERYTHING after the hero */}

      <ParallaxScript/>
    </div>
  );
}
