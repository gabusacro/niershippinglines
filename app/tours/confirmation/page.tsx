import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Booking Confirmed — Travela Siargao" };

export default async function TourConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const ref = typeof sp.ref === "string" ? sp.ref : null;

  const supabase = await createClient();

  const { data: booking } = ref ? await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title, pickup_time_label), schedule:tour_schedules(available_date, departure_time)")
    .eq("reference", ref)
    .single() : { data: null };

  if (!booking) {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-5xl mb-4">❌</div>
          <h1 className="text-xl font-bold text-gray-700">Booking not found</h1>
          <Link href="/tours" className="mt-4 inline-block text-emerald-600 underline">Browse tours</Link>
        </div>
      </div>
    );
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  return (
    <div className="min-h-screen bg-[#fafaf7]">

      {/* Hero */}
      <div className="bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-14 text-center text-white">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-2xl font-bold sm:text-3xl">Booking Submitted!</h1>
        <p className="mt-2 text-white/80 text-sm max-w-md mx-auto">
          Your booking is pending payment verification. We will confirm it shortly and send your QR voucher to your email.
        </p>
      </div>

      <div className="mx-auto max-w-lg px-4 py-10 sm:px-6">

        {/* Reference number */}
        <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-6 text-center mb-6">
          <p className="text-sm font-medium text-emerald-700 mb-1">Your Booking Reference</p>
          <p className="text-3xl font-bold text-emerald-800 tracking-widest">{booking.reference}</p>
          <p className="text-xs text-emerald-600 mt-2">Save this reference number for your records</p>
        </div>

        {/* Booking summary */}
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 mb-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Booking Summary</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Tour</span>
              <span className="font-semibold text-[#134e4a] text-right max-w-[60%]">
                {(booking.tour as { title?: string } | null)?.title ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date</span>
              <span className="font-semibold text-[#134e4a]">
                {(booking.schedule as { available_date?: string } | null)?.available_date
                  ? formatDate((booking.schedule as { available_date: string }).available_date)
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Departure</span>
              <span className="font-semibold text-[#134e4a]">
                {(booking.schedule as { departure_time?: string } | null)?.departure_time?.slice(0, 5) ?? "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Type</span>
              <span className="font-semibold text-[#134e4a] capitalize">{booking.booking_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Guests</span>
              <span className="font-semibold text-[#134e4a]">{booking.total_pax}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-500">Total Paid</span>
              <span className="text-lg font-bold text-emerald-700">
                {booking.total_amount_cents > 0
                  ? `₱${(booking.total_amount_cents / 100).toLocaleString()}`
                  : "Negotiable"}
              </span>
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⏳</span>
            <div>
              <p className="font-bold text-amber-900">Pending Payment Verification</p>
              <p className="text-sm text-amber-700 mt-0.5">
                We received your GCash screenshot and will verify it within a few hours. Once confirmed, you will receive your QR voucher at <strong>{booking.customer_email}</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* What happens next */}
        <div className="rounded-2xl border border-gray-100 bg-white p-6 mb-6">
          <h2 className="font-bold text-[#134e4a] mb-4">What happens next?</h2>
          <div className="space-y-3">
            {[
              { icon: "✅", text: "We verify your GCash payment (usually within a few hours)" },
              { icon: "📧", text: "You receive a QR voucher by email once confirmed" },
              { icon: "🏝️", text: "Show your QR voucher on the day of the tour" },
              { icon: "🕐", text: `Be at the meeting point by ${(booking.tour as { pickup_time_label?: string } | null)?.pickup_time_label ?? "the scheduled pickup time"}` },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-lg flex-shrink-0">{step.icon}</span>
                <span className="text-gray-600">{step.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div className="rounded-2xl bg-gradient-to-br from-[#0c7b93] to-[#0f766e] p-5 text-center text-white mb-6">
          <p className="font-semibold mb-1">Questions about your booking?</p>
          <p className="text-xs text-white/70 mb-3">Reference: {booking.reference}</p>
          <a href="https://m.me/travelasiargao" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-white/90">
            💬 Message us on Facebook
          </a>
        </div>

        <div className="text-center">
          <Link href="/tours"
            className="text-sm font-medium text-emerald-700 hover:underline">
            ← Browse more tours
          </Link>
        </div>

      </div>
    </div>
  );
}