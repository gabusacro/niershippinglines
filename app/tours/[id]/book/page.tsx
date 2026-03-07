import { redirect, notFound } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { BookingCalculator } from "@/components/tours/BookingCalculator";
import BookingPassengers from "@/components/tours/BookingPassengers";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("tour_packages").select("title").eq("id", id).single();
  return { title: `Book ${data?.title ?? "Tour"} — Travela Siargao` };
}

export default async function TourBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; schedule?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const { type, schedule: scheduleId } = await searchParams;
const bookingType = (type === "private" || type === "both" ? type : "joiner") as "joiner" | "private" | "both";

  const supabase = await createClient();

  // Fetch tour package
  const { data: tour } = await supabase
    .from("tour_packages")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!tour) notFound();

  // Fetch schedule if provided
  const { data: schedule } = scheduleId
    ? await supabase
        .from("tour_schedules")
        .select("*")
        .eq("id", scheduleId)
        .eq("tour_id", id)
        .single()
    : { data: null };

  // Fetch profile for auto-fill
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone")
    .eq("id", user.id)
    .single();

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">Book {tour.title}</h1>
        {schedule && (
          <p className="text-sm text-gray-500 mt-1">
            📅 {formatDate(schedule.available_date)} · 🕒 {schedule.departure_time?.slice(0, 5)}
          </p>
        )}
      </div>

      <form action="/api/tours/book" method="POST" encType="multipart/form-data" className="space-y-6">
        {/* Hidden fields */}
        <input type="hidden" name="tour_id" value={tour.id} />
        <input type="hidden" name="schedule_id" value={schedule?.id ?? ""} />
        <input type="hidden" name="booking_type" value={bookingType} />
        <input type="hidden" name="booked_by" value={user.id} />

        {/* Booking Calculator (handles pax count + price) */}
  <BookingCalculator
  bookingType={bookingType}
  joinerPriceCents={tour.price_per_pax_cents}
  privatePriceCents={tour.private_price_cents}
  privateIsNegotiable={tour.private_is_negotiable ?? false}
  joinersLeft={schedule ? (schedule.joiner_slots_total - schedule.joiner_slots_booked) : 20}
  privateLeft={schedule ? (schedule.private_slots_total - schedule.private_slots_booked) : 1}
/>

        {/* Contact Info */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 space-y-4">
          <h2 className="font-bold text-[#134e4a]">📋 Contact Information</h2>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Full Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              name="customer_name"
              defaultValue={profile?.full_name ?? ""}
              required
              placeholder="Juan Dela Cruz"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Email Address <span className="text-red-400">*</span>
            </label>
            <input
              type="email"
              name="customer_email"
              defaultValue={user.email ?? ""}
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Phone Number <span className="text-red-400">*</span>
            </label>
            <input
              type="tel"
              name="customer_phone"
              defaultValue={profile?.phone ?? ""}
              required
              placeholder="09XX XXX XXXX"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-[#134e4a] focus:outline-none focus:ring-2 focus:ring-emerald-300"
            />
          </div>
        </section>

        {/* Tourist Manifest */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <BookingPassengers
            totalPax={1}
            profileName={profile?.full_name ?? ""}
            profilePhone={profile?.phone ?? ""}
          />
        </section>

        {/* GCash Payment */}
        <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 space-y-4">
          <h2 className="font-bold text-[#134e4a]">💚 GCash Payment</h2>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
            <p className="text-sm font-semibold text-emerald-800 mb-1">Send payment to:</p>
            <p className="text-2xl font-black text-emerald-700 tracking-wide">0946 365 7331</p>
            <p className="text-xs text-emerald-600 mt-1">Gabriel Sacro · Travela Siargao</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">
              Upload GCash Screenshot <span className="text-red-400">*</span>
            </label>
            <input
              type="file"
              name="gcash_screenshot"
              accept="image/*"
              required
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-emerald-700 file:font-semibold hover:file:bg-emerald-100"
            />
          </div>
        </section>

        {/* Health Declaration */}
        {tour.requires_health_declaration && (
          <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6">
            <h2 className="font-bold text-amber-900 mb-3">⚕️ Health Declaration</h2>
            <p className="text-sm text-amber-800 mb-4 leading-relaxed">
              I confirm that I and all members of my group are physically fit to join this tour.
              We do not have any serious heart conditions, respiratory illnesses, or physical
              disabilities that may put us at risk during water or land activities.
              We understand that participants must be between 6–65 years old.
            </p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="health_declaration_accepted"
                value="true"
                required
                className="mt-0.5 h-4 w-4 rounded border-amber-300 text-emerald-600 focus:ring-emerald-300"
              />
              <span className="text-sm font-semibold text-amber-900">
                I confirm the above health declaration for all tourists in this booking.
              </span>
            </label>
          </section>
        )}

        {/* Submit */}
        <button
          type="submit"
          className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
        >
          Submit Booking →
        </button>

        <p className="text-center text-xs text-gray-400">
          Your booking is pending until payment is verified by our team.
        </p>
      </form>
    </div>
  );
}
