import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking Detail — Tour Operator" };

export default async function OperatorBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  const { data: booking } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title, pickup_time_label), schedule:tour_schedules(available_date, departure_time)")
    .eq("id", id)
    .eq("tour_operator_id", user.id)
    .single();

  if (!booking) notFound();

  const { data: passengers } = await supabase
    .from("tour_booking_passengers")
    .select("*")
    .eq("booking_id", id)
    .order("passenger_number", { ascending: true });

  // Fetch assigned guides for this operator
  const { data: rawGuides } = await supabase
    .from("tour_guide_assignments")
    .select("id, tour_guide_id")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  const guideIds = (rawGuides ?? []).map((g) => g.tour_guide_id);
  const { data: guideProfiles } = guideIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", guideIds)
    : { data: [] };

  const myGuides = (rawGuides ?? []).map((g) => ({
    id: g.id,
    tour_guide_id: g.tour_guide_id,
    guide: (guideProfiles ?? []).find((p) => p.id === g.tour_guide_id) ?? null,
  }));

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
        <Link href="/dashboard/tour-operator" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <Link href="/dashboard/tour-operator/bookings" className="hover:underline">My Bookings</Link>
        <span>/</span>
        <span className="font-mono font-semibold">{booking.reference}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">{booking.reference}</h1>
          <span className={`mt-1 inline-block rounded-full border px-3 py-0.5 text-xs font-bold ${statusColor[booking.status] ?? "bg-gray-100"}`}>
            {booking.status.toUpperCase()}
          </span>
          {booking.is_walk_in && (
            <span className="ml-2 inline-block rounded-full border border-purple-200 bg-purple-100 px-3 py-0.5 text-xs font-bold text-purple-700">
              WALK-IN
            </span>
          )}
        </div>
      </div>

      {/* Tour Details */}
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

      {/* Payment Status */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <h2 className="font-bold text-[#134e4a] mb-4">💳 Payment Status</h2>
        <div className="flex items-center gap-3">
          <span className={`px-3 py-1 rounded-full text-sm font-bold ${
            booking.payment_status === "verified"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}>
            {booking.payment_status === "verified" ? "✅ Payment Verified" : "⏳ Awaiting Payment Verification"}
          </span>
        </div>
        {booking.payment_verified_at && (
          <p className="text-xs text-gray-400 mt-2">
            Verified on {new Date(booking.payment_verified_at).toLocaleString("en-PH")}
          </p>
        )}
        {booking.is_walk_in && (
          <p className="text-xs text-emerald-600 mt-2 font-semibold">
            💵 Walk-in — Cash collected directly
          </p>
        )}
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
            <p className="font-semibold text-[#134e4a]">{booking.customer_email || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Phone</p>
            <p className="font-semibold text-[#134e4a]">{booking.customer_phone || "—"}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1">Health Declaration</p>
            <p className={`font-semibold ${booking.health_declaration_accepted ? "text-emerald-700" : "text-red-600"}`}>
              {booking.health_declaration_accepted ? "✅ Accepted" : "❌ Not accepted"}
            </p>
          </div>
        </div>
      </section>

      {/* Voucher link */}
      {booking.status === "confirmed" && (
        <section className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 mb-4">
          <p className="text-sm font-semibold text-emerald-800 mb-3">✅ Booking Confirmed — Voucher Ready</p>
          <div className="flex gap-3 flex-wrap">
            <Link href={`/tours/voucher/${booking.reference}`} target="_blank"
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">
              🎫 View Voucher
            </Link>
          </div>
        </section>
      )}

      {/* Tourist Manifest */}
      <section className="rounded-2xl border-2 border-emerald-100 bg-white p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">🧑‍🤝‍🧑 Guest Manifest</h2>
          <span className="text-xs text-gray-400">{passengers?.length ?? 0} guest/s</span>
        </div>

        {!passengers || passengers.length === 0 ? (
          <p className="text-sm text-gray-400">No guest details recorded.</p>
        ) : (
          <div className="space-y-4">
            {passengers.map((p) => (
              <div key={p.id} className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs flex items-center justify-center">
                    {p.passenger_number}
                  </span>
                  <span className="font-bold text-[#134e4a] text-sm">{p.full_name}</span>
                  {p.passenger_number === 1 && (
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
                      Lead
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
                  <div>
                    <span className="text-gray-400">Address</span>
                    <p className="font-medium text-gray-700">{p.address || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Birthdate</span>
                    <p className="font-medium text-gray-700">
                      {p.birthdate
                        ? new Date(p.birthdate + "T00:00:00").toLocaleDateString("en-PH", {
                            month: "long", day: "numeric", year: "numeric",
                          })
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-400">Age</span>
                    <p className="font-bold text-emerald-700">{p.age} yrs old</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Contact</span>
                    <p className="font-medium text-gray-700">{p.contact_number || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Emergency Contact</span>
                    <p className="font-medium text-gray-700">{p.emergency_contact_name || "—"}</p>
                  </div>
                  <div>
                    <span className="text-gray-400">Emergency Number</span>
                    <p className="font-medium text-gray-700">{p.emergency_contact_number || "—"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {passengers && passengers.length > 0 && (
          <div className="mt-4 pt-4 border-t border-emerald-100">
            <a href={`/admin/tours/bookings/${booking.id}/manifest`} target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 transition-colors">
              🖨️ Print / Export Manifest
            </a>
          </div>
        )}
      </section>

      {/* Assign Guide — placeholder for next step */}
      <section className="rounded-2xl border-2 border-blue-100 bg-white p-6 mb-4">
        <h2 className="font-bold text-[#134e4a] mb-1">🧭 Assign Tour Guide</h2>
        <p className="text-xs text-gray-400 mb-4">Assign a guide to handle this booking's guests.</p>
        {myGuides.length === 0 ? (
          <p className="text-sm text-gray-400">No guides assigned to you yet. Contact admin.</p>
        ) : (
          <div className="space-y-2">
            {myGuides.map((g) => (
              <div key={g.id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="text-sm font-semibold text-[#134e4a]">{g.guide?.full_name ?? "—"}</p>
                <span className="text-xs text-gray-400">Guide</span>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-amber-600 mt-3 font-medium">⚙️ Full dispatch/batch assignment coming soon.</p>
      </section>

      <div className="mt-4">
        <Link href="/dashboard/tour-operator/bookings"
          className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to My Bookings
        </Link>
      </div>
    </div>
  );
}