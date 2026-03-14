import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tour History — Guide" };

export default async function TourGuideHistoryPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_guide") redirect("/dashboard");

  const supabase = await createClient();
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // All my batches
  const { data: myBatches } = await supabase
    .from("tour_batches")
    .select("id, schedule_id, guide_payment_status, guide_payment_ref, guide_paid_at, service_fee_cents, batch_number, created_at")
    .eq("tour_guide_id", user.id)
    .order("created_at", { ascending: false });

  const batchIds = (myBatches ?? []).map(b => b.id);

  const { data: batchBookings } = batchIds.length > 0
    ? await supabase.from("tour_batch_bookings").select("booking_id, batch_id").in("batch_id", batchIds)
    : { data: [] };

  const bookingIds = (batchBookings ?? []).map(bb => bb.booking_id);

  const { data: allBookings } = bookingIds.length > 0
    ? await supabase
        .from("tour_bookings")
        .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time), passengers:tour_booking_passengers(*)")
        .in("id", bookingIds)
        .order("created_at", { ascending: false })
    : { data: [] };

  const { data: tracking } = bookingIds.length > 0
    ? await supabase
        .from("tour_passenger_tracking")
        .select("*")
        .in("booking_id", bookingIds)
        .eq("tour_guide_id", user.id)
    : { data: [] };

  // Build batch → bookings map
  const batchBookingMap: Record<string, string[]> = {};
  for (const bb of batchBookings ?? []) {
    if (!batchBookingMap[bb.batch_id]) batchBookingMap[bb.batch_id] = [];
    batchBookingMap[bb.batch_id].push(bb.booking_id);
  }

  // Build full batch history entries
  type BatchEntry = {
    batch_id: string;
    batch_number: number;
    schedule_date: string | null;
    tour_title: string;
    bookings: NonNullable<typeof allBookings>;
    total_pax: number;
    total_revenue_cents: number;
    service_fee_cents: number;
    guide_payment_status: string;
    guide_payment_ref: string | null;
    guide_paid_at: string | null;
    is_today: boolean;
    is_upcoming: boolean;
  };

  const batchHistory: BatchEntry[] = (myBatches ?? []).map(batch => {
    const ids = batchBookingMap[batch.id] ?? [];
    const batchBookingList = (allBookings ?? []).filter(b => ids.includes(b.id));
    const scheduleDate = batchBookingList[0]
      ? (batchBookingList[0].schedule as { available_date?: string } | null)?.available_date ?? null
      : null;
    const tourTitle = batchBookingList[0]
      ? (batchBookingList[0].tour as { title?: string } | null)?.title ?? "—"
      : "—";
    const totalPax = batchBookingList.reduce((s, b) => s + (b.total_pax ?? 0), 0);
    const totalRevenue = batchBookingList.reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);

    return {
      batch_id: batch.id,
      batch_number: batch.batch_number ?? 1,
      schedule_date: scheduleDate,
      tour_title: tourTitle,
      bookings: batchBookingList ?? [],
      total_pax: totalPax,
      total_revenue_cents: totalRevenue,
      service_fee_cents: batch.service_fee_cents ?? 0,
      guide_payment_status: batch.guide_payment_status ?? "pending",
      guide_payment_ref: batch.guide_payment_ref ?? null,
      guide_paid_at: batch.guide_paid_at ?? null,
      is_today: scheduleDate === todayPH,
      is_upcoming: scheduleDate ? scheduleDate > todayPH : false,
    };
  }).filter(e => e.schedule_date !== null)
    .sort((a, b) => (b.schedule_date ?? "").localeCompare(a.schedule_date ?? ""));

  const totalEarned = batchHistory
    .filter(e => e.guide_payment_status === "paid")
    .reduce((s, e) => s + e.service_fee_cents, 0);
  const totalPending = batchHistory
    .filter(e => e.guide_payment_status !== "paid" && e.service_fee_cents > 0)
    .reduce((s, e) => s + e.service_fee_cents, 0);
  const totalTours = batchHistory.length;
  const totalPaxAll = batchHistory.reduce((s, e) => s + e.total_pax, 0);

  function formatDate(d: string) {
    return new Date(d + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "long", month: "long", day: "numeric", year: "numeric",
    });
  }

  function formatTrackingStatus(status: string) {
    const map: Record<string, { label: string; cls: string }> = {
      assigned:    { label: "Waiting",     cls: "bg-gray-100 text-gray-500" },
      picked_up:   { label: "Picked Up",   cls: "bg-blue-100 text-blue-700" },
      on_tour:     { label: "On Tour",      cls: "bg-emerald-100 text-emerald-700" },
      dropped_off: { label: "Dropped Off",  cls: "bg-teal-100 text-teal-700" },
      no_show:     { label: "No Show",      cls: "bg-red-100 text-red-600" },
    };
    return map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  }

  const upcoming = batchHistory.filter(e => e.is_upcoming || e.is_today);
  const past     = batchHistory.filter(e => !e.is_upcoming && !e.is_today);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/dashboard/tour-guide" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold">Tour History</span>
      </div>

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Tour Guide</p>
        <h1 className="mt-1 font-bold text-2xl">📋 Tour History</h1>
        <p className="mt-1 text-sm text-white/70">All your assigned batches, passengers, and payments.</p>

        {/* Summary stats */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-xs text-white/60">Total Tours</p>
            <p className="text-xl font-bold">{totalTours}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-xs text-white/60">Total Pax</p>
            <p className="text-xl font-bold">{totalPaxAll}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-xs text-white/60">Earned</p>
            <p className="text-xl font-bold">₱{(totalEarned / 100).toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-3 py-2 text-center">
            <p className="text-xs text-white/60">Pending</p>
            <p className="text-xl font-bold text-amber-300">₱{(totalPending / 100).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {batchHistory.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 p-12 text-center">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-gray-500 font-semibold">No tour history yet</p>
          <p className="text-sm text-gray-400 mt-1">Your assigned batches will appear here.</p>
        </div>
      ) : (
        <div className="space-y-4">

          {/* Upcoming / Today */}
          {upcoming.length > 0 && (
            <>
              <h2 className="font-bold text-[#134e4a] text-sm uppercase tracking-wide">
                📅 Upcoming & Today ({upcoming.length})
              </h2>
              {upcoming.map((entry, idx) => (
                <BatchCard key={entry.batch_id} entry={entry} tracking={tracking ?? []}
                  formatDate={formatDate} formatTrackingStatus={formatTrackingStatus}
                  isToday={entry.is_today} idx={idx} />
              ))}
            </>
          )}

          {/* Past */}
          {past.length > 0 && (
            <>
              <h2 className="font-bold text-[#134e4a] text-sm uppercase tracking-wide mt-6">
                🕐 Past Tours ({past.length})
              </h2>
              {past.map((entry, idx) => (
                <BatchCard key={entry.batch_id} entry={entry} tracking={tracking ?? []}
                  formatDate={formatDate} formatTrackingStatus={formatTrackingStatus}
                  isToday={false} idx={idx} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function BatchCard({ entry, tracking, formatDate, formatTrackingStatus, isToday, idx }: {
  entry: {
    batch_id: string;
    batch_number: number;
    schedule_date: string | null;
    tour_title: string;
    bookings: Array<{
      id: string; reference: string; customer_name: string;
      total_pax: number; total_amount_cents: number; booking_source: string;
      passengers: Array<{ id: string; full_name: string; passenger_number: number }> | unknown;
    }>;
    total_pax: number;
    total_revenue_cents: number;
    service_fee_cents: number;
    guide_payment_status: string;
    guide_payment_ref: string | null;
    guide_paid_at: string | null;
  };
  tracking: Array<{ booking_id: string; passenger_id: string; status: string }>;
  formatDate: (d: string) => string;
  formatTrackingStatus: (s: string) => { label: string; cls: string };
  isToday: boolean;
  idx: number;
}) {
  const isPaid = entry.guide_payment_status === "paid";
  const hasNoFee = entry.service_fee_cents === 0;

  return (
    <div className={`rounded-2xl border-2 overflow-hidden ${isToday ? "border-emerald-400" : "border-gray-100"}`}>
      {/* Batch header */}
      <div className={`px-5 py-4 flex items-start justify-between flex-wrap gap-3 ${
        isToday ? "bg-emerald-50 border-b border-emerald-200" : "bg-gray-50 border-b border-gray-100"
      }`}>
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {isToday && <span className="text-xs bg-emerald-500 text-white px-2 py-0.5 rounded-full font-bold">TODAY</span>}
            <p className="font-bold text-[#134e4a]">🚐 {entry.tour_title}</p>
          </div>
          {entry.schedule_date && (
            <p className="text-xs text-gray-500">{formatDate(entry.schedule_date)}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {entry.total_pax} pax · {entry.bookings.length} booking{entry.bookings.length > 1 ? "s" : ""}
          </p>
        </div>

        {/* Payment info */}
        <div className="text-right">
          {hasNoFee ? (
            <span className="text-xs bg-gray-100 text-gray-500 px-3 py-1 rounded-full font-semibold">Fee not set</span>
          ) : isPaid ? (
            <div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">✅ Paid</span>
              <p className="text-sm font-bold text-emerald-700 mt-1">₱{(entry.service_fee_cents / 100).toLocaleString()}</p>
              {entry.guide_payment_ref && (
                <p className="text-xs text-gray-400 mt-0.5">GCash ref: {entry.guide_payment_ref}</p>
              )}
              {entry.guide_paid_at && (
                <p className="text-xs text-gray-400">
                  {new Date(entry.guide_paid_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
            </div>
          ) : (
            <div>
              <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">⏳ Pending</span>
              <p className="text-sm font-bold text-amber-600 mt-1">₱{(entry.service_fee_cents / 100).toLocaleString()}</p>
            </div>
          )}
        </div>
      </div>

      {/* Bookings + passengers */}
      <div className="divide-y divide-gray-50">
        {entry.bookings.map(b => {
          const passengers = (b.passengers as Array<{ id: string; full_name: string; passenger_number: number }>) ?? [];
          return (
            <div key={b.id} className="px-5 py-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                      b.booking_source === "operator_walk_in" ? "bg-purple-100 text-purple-600" :
                      b.booking_source === "walk_in" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {b.booking_source === "operator_walk_in" ? "Walk-in" :
                       b.booking_source === "walk_in" ? "Admin Walk-in" : "Online"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {b.customer_name} · {b.total_pax} pax · ₱{(b.total_amount_cents / 100).toLocaleString()} booking
                  </p>
                </div>
              </div>

              {/* Passengers with tracking status */}
              <div className="space-y-1">
                {passengers.map(p => {
                  const tracked = tracking.find(t => t.booking_id === b.id && t.passenger_id === p.id);
                  const ts = formatTrackingStatus(tracked?.status ?? "assigned");
                  return (
                    <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                      <span className="font-semibold text-gray-700">{p.passenger_number}. {p.full_name}</span>
                      <span className={`px-2 py-0.5 rounded-full font-semibold ${ts.cls}`}>{ts.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
