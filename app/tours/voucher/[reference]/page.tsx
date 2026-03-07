import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tour Voucher — Travela Siargao" };

export default async function TourVoucherPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title, pickup_time_label, end_time_label, meeting_point), schedule:tour_schedules(available_date, departure_time)")
    .eq("reference", reference)
    .single();

  if (!booking) notFound();

  // Only show voucher for confirmed bookings
  if (booking.status !== "confirmed" && booking.status !== "completed") {
    return (
      <div className="min-h-screen bg-[#fafaf7] flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-xl font-bold text-gray-700">Voucher Not Ready</h1>
          <p className="text-sm text-gray-500 mt-2">
            Your booking is still pending payment verification. Your QR voucher will be available once confirmed.
          </p>
          <p className="mt-3 font-mono font-bold text-emerald-700">{reference}</p>
        </div>
      </div>
    );
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const tour   = booking.tour   as { title?: string; pickup_time_label?: string; end_time_label?: string; meeting_point?: string } | null;
  const schedule = booking.schedule as { available_date?: string; departure_time?: string } | null;

  // QR code using Google Charts API (no npm package needed)
  const qrData = encodeURIComponent(reference);
  const qrUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${qrData}&bgcolor=ffffff&color=0c7b93&margin=10`;

  return (
    <div className="min-h-screen bg-[#fafaf7]">

      {/* Header */}
      <div className="bg-gradient-to-br from-[#0c7b93] to-[#0f766e] px-6 py-10 text-center text-white">
        <div className="text-4xl mb-2">🏝️</div>
        <h1 className="text-2xl font-bold">Your Tour Voucher</h1>
        <p className="text-white/80 text-sm mt-1">Present this QR code on the day of your tour</p>
      </div>

      <div className="mx-auto max-w-sm px-4 py-10 sm:px-6">

        {/* QR Code */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-white p-8 text-center mb-6 shadow-sm">
          <img
            src={qrUrl}
            alt={`QR Code for ${reference}`}
            width={200}
            height={200}
            className="mx-auto rounded-xl"
          />
          <p className="mt-4 font-mono text-xl font-bold text-emerald-700 tracking-widest">
            {reference}
          </p>
          <p className="text-xs text-gray-400 mt-1">Scan to verify booking</p>
        </div>

        {/* Booking details */}
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Booking Details</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Tour</span>
              <span className="font-semibold text-[#134e4a] text-right max-w-[60%]">{tour?.title ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Date</span>
              <span className="font-semibold text-[#134e4a]">
                {schedule?.available_date ? formatDate(schedule.available_date) : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Departure</span>
              <span className="font-semibold text-[#134e4a]">
                {schedule?.departure_time?.slice(0, 5) ?? "—"}
              </span>
            </div>
            {tour?.pickup_time_label && (
              <div className="flex justify-between">
                <span className="text-gray-400">Pickup</span>
                <span className="font-semibold text-[#134e4a]">{tour.pickup_time_label}</span>
              </div>
            )}
            {tour?.meeting_point && (
              <div className="flex justify-between">
                <span className="text-gray-400">Meeting Point</span>
                <span className="font-semibold text-[#134e4a]">{tour.meeting_point}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-400">Type</span>
              <span className="font-semibold text-[#134e4a] capitalize">{booking.booking_type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Guests</span>
              <span className="font-semibold text-[#134e4a]">{booking.total_pax}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Name</span>
              <span className="font-semibold text-[#134e4a]">{booking.customer_name}</span>
            </div>
            <div className="flex justify-between border-t border-gray-100 pt-3">
              <span className="text-gray-400">Amount Paid</span>
              <span className="font-bold text-emerald-700">
                {booking.total_amount_cents > 0
                  ? `₱${(booking.total_amount_cents / 100).toLocaleString()}`
                  : "Negotiable"}
              </span>
            </div>
          </div>
        </div>

        {/* Status badge */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-4 text-center mb-6">
          <span className="text-emerald-700 font-bold text-sm">✅ PAYMENT CONFIRMED</span>
          <p className="text-xs text-emerald-600 mt-1">This voucher is valid for the tour date above</p>
        </div>

        {/* Reminders */}
        <div className="rounded-2xl border border-gray-100 bg-white p-5 mb-6">
          <h2 className="font-bold text-[#134e4a] mb-3">📋 Reminders</h2>
          <ul className="space-y-2 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">🕐</span>
              <span>Be at the meeting point <strong>15 minutes before</strong> departure</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">📱</span>
              <span>Show this QR code to your guide upon arrival</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">🌤</span>
              <span>Wear comfortable clothes and bring sunscreen, water, and a change of clothes</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="flex-shrink-0">📞</span>
              <span>Questions? Message us on Facebook or call 0946 365 7331</span>
            </li>
          </ul>
        </div>

        {/* Print button */}
        <button
          onClick={() => window.print()}
          className="w-full rounded-xl border-2 border-emerald-200 bg-white py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors mb-3">
          🖨️ Print / Save as PDF
        </button>

        <div className="text-center">
          <Link href="/tours" className="text-sm text-emerald-600 hover:underline">
            ← Browse more tours
          </Link>
        </div>

      </div>
    </div>
  );
}