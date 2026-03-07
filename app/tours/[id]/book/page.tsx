import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { BookingCalculator } from "@/components/tours/BookingCalculator";

export const metadata = { title: "Book Tour — Travela Siargao" };

export default async function BookTourPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  const { id } = await params;
  const sp = await searchParams;
  const scheduleId = typeof sp.schedule === "string" ? sp.schedule : null;

  if (!scheduleId) redirect(`/tours/${id}`);

  const supabase = await createClient();

  const { data: pkg } = await supabase
    .from("tour_packages")
    .select("id, title, joiner_price_cents, private_price_cents, private_is_negotiable, per_person_price_cents, hourly_price_min_cents, hourly_price_max_cents, exclusive_price_cents, exclusive_unit_label, accepts_joiners, accepts_private, pickup_time_label, end_time_label, duration_label, requires_health_declaration, is_weather_dependent")
    .eq("id", id)
    .eq("is_active", true)
    .single();

  if (!pkg) notFound();

  const { data: schedule } = await supabase
    .from("tour_schedules")
    .select("id, available_date, departure_time, joiner_slots_total, joiner_slots_booked, private_slots_total, private_slots_booked, cutoff_at")
    .eq("id", scheduleId)
    .eq("status", "open")
    .single();

  if (!schedule) redirect(`/tours/${id}`);

  const joinersLeft = schedule.joiner_slots_total - schedule.joiner_slots_booked;
  const privateLeft = schedule.private_slots_total - schedule.private_slots_booked;

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const bookingType = pkg.accepts_joiners && pkg.accepts_private ? "both"
    : pkg.accepts_private ? "private"
    : "joiner";

  return (
    <div className="min-h-screen bg-[#fafaf7]">
      <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-10 text-white">
        <div className="mx-auto max-w-2xl">
          <Link href={`/tours/${id}`} className="text-sm text-white/70 hover:text-white mb-3 inline-block">
            ← Back to {pkg.title}
          </Link>
          <h1 className="text-2xl font-bold">Book Tour</h1>
          <p className="text-white/80 text-sm mt-1">{pkg.title}</p>
          <div className="mt-3 flex flex-wrap gap-4 text-sm text-white/80">
            <span>📅 {formatDate(schedule.available_date)}</span>
            <span>🕐 Departure: {schedule.departure_time?.slice(0, 5)}</span>
          </div>
        </div>
      </div><div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">

        {!user && (
          <div className="mb-6 rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
            💡 <strong>Have an account?</strong>{" "}
            <Link href={`/login?redirect=/tours/${id}/book?schedule=${scheduleId}`} className="underline font-semibold">
              Log in
            </Link>{" "}
            to pre-fill your details. Or continue as guest below.
          </div>
        )}

        <form action="/api/tours/book" method="POST" encType="multipart/form-data">
          <input type="hidden" name="tour_id" value={id} />
          <input type="hidden" name="schedule_id" value={scheduleId} />

          {/* Calculator — booking type + pax counter + price summary */}
          <div className="mb-4">
            <BookingCalculator
              bookingType={bookingType}
              joinerPriceCents={pkg.joiner_price_cents}
              privatePriceCents={pkg.private_price_cents}
              privateIsNegotiable={pkg.private_is_negotiable ?? false}
              joinersLeft={joinersLeft}
              privateLeft={privateLeft}
            />
          </div>

          {/* Contact details */}
          <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
            <h2 className="font-bold text-[#134e4a] mb-4">Your Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input type="text" name="first_name" required
                    defaultValue={user?.fullName?.split(" ")[0] ?? ""}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input type="text" name="last_name" required
                    defaultValue={user?.fullName?.split(" ").slice(1).join(" ") ?? ""}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input type="email" name="email" required
                  defaultValue={user?.email ?? ""}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone / GCash Number <span className="text-red-500">*</span></label>
                <input type="tel" name="phone" required placeholder="09xxxxxxxxx"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
              </div>
            </div>
          </section>

          {/* Health declaration */}
          {pkg.requires_health_declaration && (
            <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 mb-4">
              <h2 className="font-bold text-amber-900 mb-3">⚠️ Health Declaration</h2>
              <p className="text-sm text-amber-800 mb-4">
                This tour involves physical activity and boat travel. Guests with serious heart conditions, respiratory illness, or other serious medical conditions are advised not to join for their own safety.
              </p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" name="health_declaration" required
                  className="mt-0.5 rounded border-amber-300 text-emerald-600 w-4 h-4 flex-shrink-0" />
                <span className="text-sm text-amber-900 font-medium">
                  I confirm that I and all guests in my booking are in good health and fit to join this tour.
                </span>
              </label>
            </section>
          )}

          {/* Weather disclaimer */}
          {pkg.is_weather_dependent && (
            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-4">
              <p className="text-sm text-blue-800">
                🌤 <strong>Weather dependent:</strong> This tour may be cancelled or rescheduled due to bad weather or sea conditions. You will be notified and offered a full refund or reschedule.
              </p>
            </section>
          )}

          {/* GCash payment */}
          <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
            <h2 className="font-bold text-[#134e4a] mb-2">💚 GCash Payment</h2>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 mb-4 text-sm text-emerald-800">
              <p className="font-semibold mb-1">Send payment to:</p>
              <p className="text-lg font-bold text-emerald-700">0946 365 7331</p>
              <p className="text-xs text-emerald-600 mt-1">Account name: Gabriel Sacro · Ref: your name + tour date</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Upload GCash Screenshot <span className="text-red-500">*</span>
              </label>
              <input type="file" name="gcash_screenshot" accept="image/*" required
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-emerald-700" />
              <p className="text-xs text-gray-400 mt-1">JPG or PNG, max 5MB</p>
            </div>
          </section>

          <button type="submit"
            className="w-full rounded-xl bg-emerald-600 py-4 text-base font-bold text-white hover:bg-emerald-700 transition-colors">
            Submit Booking →
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">
            Your booking will be confirmed once we verify your payment. You will receive a QR voucher by email.
          </p>
        </form>

      </div>
    </div>
  );
}