import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tour Booking Detail — Admin" };

export default async function AdminTourBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title, pickup_time_label), schedule:tour_schedules(available_date, departure_time, joiner_slots_total, joiner_slots_booked)")
    .eq("id", id)
    .single();

  if (!booking) notFound();

  // Generate signed URL for GCash screenshot
  let gcashSignedUrl: string | null = null;
  if (booking.gcash_screenshot_url) {
    // Extract the path from the full URL
    const urlParts = booking.gcash_screenshot_url.split("/payment-proofs/");
    const filePath = urlParts[1];
    if (filePath) {
      const { data: signedData } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(filePath, 3600); // 1 hour
      gcashSignedUrl = signedData?.signedUrl ?? null;
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  const statusColor: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700 border-amber-200",
    confirmed: "bg-emerald-100 text-emerald-700 border-emerald-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
    no_show:   "bg-red-100 text-red-700 border-red-200",
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <Link href="/admin/tours/bookings" className="hover:underline">Bookings</Link>
        <span>/</span>
        <span className="font-mono font-semibold">{booking.reference}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">{booking.reference}</h1>
          <span className={`mt-1 inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${statusColor[booking.status] ?? "bg-gray-100"}`}>
            {booking.status.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Tour + Schedule */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <h2 className="font-bold text-[#134e4a] mb-4">Tour Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Tour</p>
            <p className="font-semibold text-[#134e4a]">{(booking.tour as { title?: string } | null)?.title ?? "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Date</p>
            <p className="font-semibold text-[#134e4a]">
              {(booking.schedule as { available_date?: string } | null)?.available_date
                ? formatDate((booking.schedule as { available_date: string }).available_date)
                : "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Departure</p>
            <p className="font-semibold text-[#134e4a]">
              {(booking.schedule as { departure_time?: string } | null)?.departure_time?.slice(0, 5) ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Booking Type</p>
            <p className="font-semibold text-[#134e4a] capitalize">{booking.booking_type}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Guests</p>
            <p className="font-semibold text-[#134e4a]">{booking.total_pax}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Total Amount</p>
            <p className="font-bold text-emerald-700 text-lg">
              {booking.total_amount_cents > 0
                ? `₱${(booking.total_amount_cents / 100).toLocaleString()}`
                : "Negotiable"}
            </p>
          </div>
        </div>
      </section>

      {/* Customer */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <h2 className="font-bold text-[#134e4a] mb-4">Customer</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Name</p>
            <p className="font-semibold text-[#134e4a]">{booking.customer_name}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Email</p>
            <p className="font-semibold text-[#134e4a]">{booking.customer_email}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Phone</p>
            <p className="font-semibold text-[#134e4a]">{booking.customer_phone}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Health Declaration</p>
            <p className={`font-semibold ${booking.health_declaration_accepted ? "text-emerald-700" : "text-red-600"}`}>
              {booking.health_declaration_accepted ? "✅ Accepted" : "❌ Not accepted"}
            </p>
            {booking.health_declaration_accepted_at && (
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(booking.health_declaration_accepted_at).toLocaleString("en-PH")}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* GCash Screenshot */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <h2 className="font-bold text-[#134e4a] mb-4">💚 GCash Payment Proof</h2>
        {gcashSignedUrl ? (
          <div>
            <img
              src={gcashSignedUrl}
              alt="GCash Screenshot"
              className="rounded-xl border border-gray-200 max-w-full max-h-96 object-contain mb-3"
            />
            <a href={booking.gcash_screenshot_url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-emerald-600 hover:underline">
              Open full image →
            </a>
          </div>
        ) : (
          <p className="text-sm text-gray-400">No screenshot uploaded.</p>
        )}
      </section>

      {/* Actions */}
      {booking.status === "pending" && (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 mb-4">
          <h2 className="font-bold text-amber-900 mb-4">⏳ Confirm Payment</h2>
          <p className="text-sm text-amber-700 mb-4">
            Review the GCash screenshot above. Once verified, click Confirm to mark as confirmed and send the QR voucher to the customer.
          </p>
          <div className="flex gap-3">
            <form action="/api/admin/tours/bookings/confirm" method="POST">
              <input type="hidden" name="booking_id" value={booking.id} />
              <input type="hidden" name="reference" value={booking.reference} />
              <button type="submit"
                className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-emerald-700 transition-colors">
                ✅ Confirm Payment
              </button>
            </form>
            <form action="/api/admin/tours/bookings/cancel" method="POST">
              <input type="hidden" name="booking_id" value={booking.id} />
              <button type="submit"
                className="rounded-xl border border-red-200 bg-red-50 px-6 py-2.5 text-sm font-bold text-red-600 hover:bg-red-100 transition-colors">
                ❌ Cancel Booking
              </button>
            </form>
          </div>
        </section>
      )}

      {/* Already confirmed info */}
      {booking.status === "confirmed" && (
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 mb-4">
          <p className="text-sm font-semibold text-emerald-800">
            ✅ Payment confirmed
            {booking.payment_verified_at
              ? ` on ${new Date(booking.payment_verified_at).toLocaleString("en-PH")}`
              : ""}
          </p>
        </section>
      )}

      <div className="mt-4">
        <Link href="/admin/tours/bookings"
          className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to Bookings
        </Link>
      </div>
    </div>
  );
}