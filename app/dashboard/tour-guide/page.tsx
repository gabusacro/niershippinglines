import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import TourGuideScanner from "./TourGuideScanner";
import TourGuideEarningsClient from "./TourGuideEarningsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tour Guide Dashboard" };

export default async function TourGuideDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_guide") redirect("/dashboard");

  const supabase = await createClient();
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // My operator
  const { data: myAssignment } = await supabase
    .from("tour_guide_assignments")
    .select("tour_operator_id, is_active")
    .eq("tour_guide_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  const { data: operatorProfile } = myAssignment?.tour_operator_id
    ? await supabase
        .from("profiles")
        .select("full_name, email, mobile")
        .eq("id", myAssignment.tour_operator_id)
        .maybeSingle()
    : { data: null };

  // My assigned batches — ALL of them
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

  // All bookings — confirmed AND completed for history
  const { data: allBookings } = bookingIds.length > 0
    ? await supabase
        .from("tour_bookings")
        .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time), passengers:tour_booking_passengers(*)")
        .in("id", bookingIds)
        .in("status", ["confirmed", "completed", "cancelled"])
        .order("created_at", { ascending: false })
    : { data: [] };

  // Tracking
  const { data: tracking } = bookingIds.length > 0
    ? await supabase
        .from("tour_passenger_tracking")
        .select("*")
        .in("booking_id", bookingIds)
        .eq("tour_guide_id", user.id)
    : { data: [] };

  // Today's bookings
  const todayBookings = (allBookings ?? []).filter(b => {
    const d = (b.schedule as { available_date?: string } | null)?.available_date;
    return d === todayPH;
  });

  // Build batch → bookings map
  const batchBookingMap: Record<string, string[]> = {};
  for (const bb of batchBookings ?? []) {
    if (!batchBookingMap[bb.batch_id]) batchBookingMap[bb.batch_id] = [];
    batchBookingMap[bb.batch_id].push(bb.booking_id);
  }

  const totalGuests = todayBookings.reduce((sum, b) => sum + (b.total_pax ?? 0), 0);
  const pickedUp = (tracking ?? []).filter(t => t.status !== "assigned").length;
  const operator = operatorProfile as { full_name: string | null; email: string | null; mobile: string | null } | null;

  // Earnings data per batch
  const earningsData = (myBatches ?? []).map(batch => {
    const ids = batchBookingMap[batch.id] ?? [];
    const batchBookingList = (allBookings ?? []).filter(b => ids.includes(b.id));
    const scheduleDate = batchBookingList[0]
      ? (batchBookingList[0].schedule as { available_date?: string } | null)?.available_date ?? null
      : null;
    const tourTitle = batchBookingList[0]
      ? (batchBookingList[0].tour as { title?: string } | null)?.title ?? "—"
      : "—";
    const totalPax = batchBookingList.reduce((s, b) => s + (b.total_pax ?? 0), 0);
    return {
      batch_id: batch.id,
      schedule_date: scheduleDate,
      tour_title: tourTitle,
      total_pax: totalPax,
      booking_count: batchBookingList.length,
      service_fee_cents: batch.service_fee_cents ?? 0,
      guide_payment_status: batch.guide_payment_status ?? "pending",
      guide_payment_ref: batch.guide_payment_ref ?? null,
      guide_paid_at: batch.guide_paid_at ?? null,
    };
  }).filter(e => e.schedule_date !== null);

  // Today's batches — for the today section
  const todayBatches = (myBatches ?? []).filter(batch => {
    const ids = batchBookingMap[batch.id] ?? [];
    return (allBookings ?? []).some(b => {
      if (!ids.includes(b.id)) return false;
      const d = (b.schedule as { available_date?: string } | null)?.available_date;
      return d === todayPH;
    });
  });

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg mb-5">
        <div className="pointer-events-none absolute inset-0 opacity-10"
          style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3C/svg%3E")`, backgroundSize: "240px 120px", backgroundRepeat: "repeat" }} />
        <span className="pointer-events-none absolute -right-4 top-0 select-none text-[8rem] leading-none opacity-[0.07]">🌴</span>
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Tour Guide Dashboard</p>
            <h1 className="mt-1 font-bold text-3xl leading-tight">Welcome, {user.fullName?.split(" ")[0] ?? "Guide"}! 👋</h1>
            <p className="mt-1 text-sm text-white/70">
              {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{totalGuests}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Today&apos;s Guests</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{todayBatches.length}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Today&apos;s Batches</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{pickedUp}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Picked Up</div>
            </div>
          </div>
        </div>
      </div>

      {/* My Operator */}
      {operator ? (
        <div className="mb-5 rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">My Operator</p>
          <p className="font-bold text-emerald-900">{operator.full_name ?? "—"}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-emerald-700">
            {operator.email && <span>{operator.email}</span>}
            {operator.mobile && <span>{operator.mobile}</span>}
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-2xl border-2 border-amber-100 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-700 font-semibold">Not linked to an operator yet.</p>
          <p className="text-xs text-amber-600 mt-0.5">Contact admin to get linked to your tour operator.</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <Link href="/dashboard/account"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800 text-center transition-colors hover:border-blue-400 hover:bg-blue-50">
          👤 My Account
        </Link>
        <Link href="/dashboard/tour-guide/history"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
          📋 Tour History
        </Link>
      </div>

      {/* Scanner */}
      <div className="mb-5">
        <TourGuideScanner guideId={user.id} todayPH={todayPH} />
      </div>

      {/* Earnings */}
      <TourGuideEarningsClient earnings={earningsData} todayPH={todayPH} />

      {/* Today's Batches — full detail */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 mt-5">
        <h2 className="font-bold text-[#134e4a] mb-1">
          Today&apos;s Batches
          <span className="ml-2 text-sm font-normal text-gray-400">{totalGuests} total guests</span>
        </h2>
        <p className="text-xs text-gray-400 mb-4">All bookings assigned to you today across all batches.</p>

        {todayBatches.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No batches assigned to you today.</p>
        ) : (
          <div className="space-y-4">
            {todayBatches.map((batch, batchIdx) => {
              const ids = batchBookingMap[batch.id] ?? [];
              const batchBookingList = (allBookings ?? []).filter(b => ids.includes(b.id));
              const batchPax = batchBookingList.reduce((s, b) => s + b.total_pax, 0);
              const isPaid = batch.guide_payment_status === "paid";

              return (
                <div key={batch.id} className="rounded-2xl border-2 border-emerald-100 overflow-hidden">
                  {/* Batch header */}
                  <div className="bg-emerald-50 border-b border-emerald-100 px-5 py-3 flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <p className="font-bold text-[#134e4a]">
                        🚐 Batch {batchIdx + 1}
                        {batchBookingList[0] && (
                          <span className="ml-2 text-sm font-normal text-gray-500">
                            — {(batchBookingList[0].tour as { title?: string } | null)?.title ?? "—"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">{batchPax} pax total</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <div className="text-right">
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full font-bold">✅ Paid</span>
                          {batch.service_fee_cents > 0 && (
                            <p className="text-xs text-emerald-600 font-bold mt-0.5">₱{(batch.service_fee_cents / 100).toLocaleString()}</p>
                          )}
                          {batch.guide_payment_ref && (
                            <p className="text-xs text-gray-400">ref: {batch.guide_payment_ref}</p>
                          )}
                          {batch.guide_paid_at && (
                            <p className="text-xs text-gray-400">
                              {new Date(batch.guide_paid_at).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="text-xs bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-bold">⏳ Payment Pending</span>
                          {batch.service_fee_cents > 0 && (
                            <p className="text-xs text-amber-600 font-bold mt-0.5">₱{(batch.service_fee_cents / 100).toLocaleString()} expected</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bookings in batch */}
                  <div className="divide-y divide-gray-50">
                    {batchBookingList.map(b => {
                      const passengers = b.passengers as Array<{ id: string; full_name: string; passenger_number: number }> ?? [];
                      return (
                        <div key={b.id} className="px-5 py-4">
                          {/* Booking header */}
                          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
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
                                {b.customer_name} · {b.total_pax} pax
                                · ₱{(b.total_amount_cents / 100).toLocaleString()}
                              </p>
                            </div>
                            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                              {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                            </span>
                          </div>

                          {/* Passenger list with tracking */}
                          <div className="space-y-1.5">
                            {passengers.length === 0 ? (
                              <p className="text-xs text-gray-400 italic">No passenger details</p>
                            ) : passengers.map(p => {
                              const tracked = (tracking ?? []).find(
                                t => t.booking_id === b.id && t.passenger_id === p.id
                              );
                              const ts = formatTrackingStatus(tracked?.status ?? "assigned");
                              return (
                                <div key={p.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                                  <div>
                                    <span className="font-semibold text-gray-700">{p.passenger_number}. {p.full_name}</span>
                                  </div>
                                  <span className={`px-2 py-0.5 rounded-full font-semibold ${ts.cls}`}>
                                    {ts.label}
                                  </span>
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
            })}
          </div>
        )}
      </div>

    </div>
  );
}
