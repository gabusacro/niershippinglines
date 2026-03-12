import { getAuthUser } from "@/lib/auth/get-user";
import { getUpcomingTrips } from "@/lib/dashboard/get-upcoming-trips";
import { getActiveAnnouncements } from "@/lib/announcements/get-announcements";
import { AnnouncementsBlock } from "@/components/announcements/AnnouncementsBlock";
import { TripCalendar } from "@/app/dashboard/TripCalendar";
import { Boat } from "@/components/icons";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Book Ferry to Siargao Island | Travela Siargao",
  description:
    "Book your Siargao ferry online. Daily trips from Surigao City to Dapa (Siargao Island) and Dinagat. Real-time seat availability, senior, PWD & student discounts. Fast, easy GCash payment.",
  keywords: [
    "book ferry siargao",
    "siargao island ferry booking",
    "surigao to siargao ferry",
    "dapa siargao ferry ticket",
    "siargao boat trip",
    "online ferry booking siargao",
    "siargao island travel",
    "dinagat ferry booking",
  ],
  openGraph: {
    title: "Book Ferry to Siargao Island | Travela Siargao",
    description:
      "Book your Siargao ferry online. Daily trips, real-time seats, GCash payment. Senior, PWD & student discounts available.",
    url: "https://www.travelasiargao.com/book",
    siteName: "Travela Siargao",
    type: "website",
  },
};

export default async function BookPage() {
  const [user, trips, announcements] = await Promise.all([
    getAuthUser(),
    getUpcomingTrips(),
    getActiveAnnouncements(),
  ]);

  const loggedInEmail      = (user?.email      ?? "").trim();
  const loggedInName       = (user?.fullName    ?? "").trim();
  const loggedInAddress    = (user?.address     ?? "").trim();
  const loggedInGender     = (user?.gender      ?? "").trim();
  const loggedInBirthdate  = (user?.birthdate   ?? "").trim();
  const loggedInNationality = (user?.nationality ?? "").trim();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">

      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-8 sm:mb-10">
        <div className="rounded-full bg-[#0c7b93]/10 p-3 w-fit">
          <Boat size={28} className="text-[#0c7b93]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#134e4a] sm:text-2xl">
            Book a Ferry to Siargao Island
          </h1>
          <p className="text-sm text-[#0f766e] sm:text-base">
            Daily trips · Surigao City ↔ Dapa (Siargao) · Dinagat ↔ Surigao · Real-time seat availability
          </p>
        </div>
      </div>

      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="mb-8">
          <AnnouncementsBlock announcements={announcements} />
        </div>
      )}

      {/* Info strip */}
      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {[
          { emoji: "🎟️", title: "Online seats limited", desc: "We reserve a quota for online booking. Walk-in seats available at the pier." },
          { emoji: "📱", title: "Pay via GCash", desc: "Send payment and upload your screenshot as proof to confirm your booking." },
          { emoji: "🎫", title: "Instant e-ticket", desc: "Get your QR code ticket right away. Show it at the pier for boarding." },
        ].map((item, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-teal-200 bg-white p-4 shadow-sm">
            <span className="text-2xl shrink-0">{item.emoji}</span>
            <div>
              <p className="font-semibold text-[#134e4a] text-sm">{item.title}</p>
              <p className="text-xs text-[#0f766e] mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Discount notice */}
      <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3">
        <p className="text-sm font-semibold text-amber-900">
          🪪 Discounts available — Senior (60+), PWD, Student & Child fares. Bring valid ID at boarding.
          Infants (under 2 yrs) travel FREE.
        </p>
      </div>

      {/* ✅ TripCalendar + BookingModal — same as dashboard */}
      <TripCalendar
        trips={trips}
        loggedInEmail={loggedInEmail}
        passengerName={loggedInName}
        loggedInAddress={loggedInAddress}
        loggedInGender={loggedInGender}
        loggedInBirthdate={loggedInBirthdate}
        loggedInNationality={loggedInNationality}
      />

      {/* SEO content block */}
      <section className="mt-12 rounded-2xl border border-teal-100 bg-white p-6 shadow-sm space-y-4">
        <h2 className="text-lg font-bold text-[#134e4a]">
          Siargao Island Ferry — Everything You Need to Know
        </h2>
        <p className="text-sm text-[#0f766e] leading-relaxed">
          Travela Siargao operates daily ferry trips between <strong>Surigao City (Mainland)</strong> and{" "}
          <strong>Dapa Port, Siargao Island</strong>, as well as routes connecting{" "}
          <strong>Dinagat Island</strong> to Surigao City. Book your seats online and skip the queue at the pier.
        </p>
        <p className="text-sm text-[#0f766e] leading-relaxed">
          Online booking is available for a limited quota of seats per trip — this ensures a smooth
          experience for passengers who book in advance. Additional walk-in seats may be available
          at the pier on the day of travel.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 text-sm text-[#0f766e]">
          <div>
            <p className="font-semibold text-[#134e4a] mb-1">Routes served</p>
            <ul className="space-y-1">
              <li>🚢 Dapa (Siargao Island) → Surigao City (Mainland)</li>
              <li>🚢 Surigao City (Mainland) → Dapa (Siargao Island)</li>
              <li>🚢 Dinagat Island → Surigao City</li>
              <li>🚢 Surigao City → Dinagat Island</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-[#134e4a] mb-1">Fare types</p>
            <ul className="space-y-1">
              <li>👤 Adult — regular fare</li>
              <li>👴 Senior Citizen (60+) — 20% discount</li>
              <li>♿ PWD — 20% discount</li>
              <li>🎒 Student — 20% discount</li>
              <li>👦 Child (3–10 yrs) — 50% discount</li>
              <li>👶 Infant (under 2 yrs) — FREE</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-[#0f766e]/70">
          Arrive at the pier at least 30–60 minutes before departure. Port/terminal fees are not
          included in the online fare and are collected separately at the pier.
        </p>
      </section>

    </div>
  );
}
