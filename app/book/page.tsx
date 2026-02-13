import Link from "next/link";
import { APP_NAME, ROUTES } from "@/lib/constants";
import { Boat, Wave } from "@/components/icons";
import BookingForm from "./BookingForm";
import { HowItWorksSection } from "./HowItWorksSection";
import { getAuthUser } from "@/lib/auth/get-user";
import { getActiveAnnouncements } from "@/lib/announcements/get-announcements";
import { AnnouncementsBlock } from "@/components/announcements/AnnouncementsBlock";

export const metadata = {
  title: "Book A Trip",
  description: `Book ferry tickets — ${APP_NAME}`,
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ route_id?: string; date?: string }>;
}) {
  const params = await searchParams;
  const [announcements, user] = await Promise.all([
    getActiveAnnouncements(),
    getAuthUser(),
  ]);
  const loggedInEmail = (user?.email ?? "").trim();
  const loggedInAddress = (user?.address ?? "").trim();
  const initialRouteId = typeof params.route_id === "string" ? params.route_id.trim() : undefined;
  const initialDate = typeof params.date === "string" ? params.date.trim() : undefined;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 mb-8 sm:mb-10">
        <div className="rounded-full bg-[#0c7b93]/10 p-3 w-fit">
          <Boat size={28} className="text-[#0c7b93]" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-[#134e4a] sm:text-2xl">Book A Trip</h1>
          <p className="text-sm text-[#0f766e] sm:text-base">Reserve your seat in a few steps. Booking will connect to live inventory soon.</p>
        </div>
      </div>

      {announcements.length > 0 && (
        <div className="mb-8 sm:mb-10">
          <AnnouncementsBlock announcements={announcements} />
        </div>
      )}

      <HowItWorksSection />

      {/* Pricing (static) */}
      <section className="rounded-2xl border border-teal-200 bg-[#fef9e7]/80 p-4 sm:p-6 mb-8 sm:mb-10">
        <h2 className="font-semibold text-[#134e4a] flex items-center gap-2 mb-3 sm:mb-4 text-sm sm:text-base">
          <Wave size={20} className="text-[#0c7b93] shrink-0" />
          Fare (sample — will be configurable)
        </h2>
        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-4 border border-teal-100">
            <p className="font-semibold text-[#134e4a]">Regular (adult)</p>
            <p className="text-2xl font-bold text-[#0c7b93]">₱550</p>
            <p className="text-sm text-[#0f766e]">per person, one way</p>
          </div>
          <div className="rounded-xl bg-white p-4 border border-teal-100">
            <p className="font-semibold text-[#134e4a]">Senior / PWD / Child</p>
            <p className="text-2xl font-bold text-[#0c7b93]">20% off</p>
            <p className="text-sm text-[#0f766e]">Valid ID may be required at check-in</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-[#0f766e]">
          Same base fare for Siargao and Dinagat routes. Reschedule: 10% + ₱15 (24+ hours before departure only). No seat numbers—first-come seating at the pier. Fee breakdown: Fare + Admin fee (₱15/pax) + GCash fee (₱15 per transaction).
        </p>
        <p className="mt-2 text-sm font-medium text-amber-800">
          For a smooth trip, please arrive at the port <strong>30 min–1 hour</strong> before boarding. Once the vessel has departed, we’re unable to offer refunds or rebooking.
        </p>
      </section>

      {/* Booking form — connected to Supabase. Pre-fill email when logged in so booking appears in My bookings. */}
      <section className="mb-8 sm:mb-10">
        <BookingForm
          loggedInEmail={loggedInEmail}
          loggedInAddress={loggedInAddress}
          initialRouteId={initialRouteId}
          initialDate={initialDate}
        />
      </section>
      <div className="text-center rounded-xl bg-[#0c7b93]/10 border border-teal-200 p-6 sm:p-8">
        <p className="text-xs sm:text-sm text-[#0f766e]">Check the Schedule and Attractions to plan your trip.</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4">
          <Link href={ROUTES.schedule} className="min-h-[48px] flex items-center justify-center rounded-xl border-2 border-[#0c7b93] px-6 py-3 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors touch-target sm:min-h-0">
            View schedule
          </Link>
          <Link href={ROUTES.attractions} className="min-h-[48px] flex items-center justify-center rounded-xl bg-[#0c7b93] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors touch-target sm:min-h-0">
            Explore Siargao
          </Link>
        </div>
      </div>
    </div>
  );
}
