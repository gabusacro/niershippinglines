import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import TourOperatorDashboardClient from "./TourOperatorDashboardClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tour Operator Dashboard" };

export default async function TourOperatorDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const supabase = await createClient();
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // My assigned guides
  const { data: rawGuides } = await supabase
    .from("tour_guide_assignments")
    .select("id, tour_guide_id, assigned_at")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  const guideIds = (rawGuides ?? []).map((g) => g.tour_guide_id);
  const { data: guideProfiles } = guideIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email, mobile").in("id", guideIds)
    : { data: [] };

  const myGuides = (rawGuides ?? []).map((g) => ({
    ...g,
    guide: (guideProfiles ?? []).find((p) => p.id === g.tour_guide_id) ?? null,
  }));

  // Pending bookings count
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "pending");

  // All confirmed bookings for dashboard (upcoming + status view)
  const { data: allBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(100);

  // All VERIFIED bookings for revenue dashboard (all sources assigned to this operator)
  const { data: revenueBookings } = await supabase
    .from("tour_bookings")
    .select("id, reference, total_amount_cents, booking_source, payment_status, payment_verified_at, operator_payment_status, operator_payment_ref, operator_paid_at, customer_name, total_pax, tour:tour_packages(title), schedule:tour_schedules(available_date)")
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "verified")
    .order("payment_verified_at", { ascending: false })
    .limit(500);

  // All booking IDs for tracking
  const allBookingIds = (allBookings ?? []).map((b) => b.id);

  // Batch → guide mapping
  const { data: allBatchBookings } = allBookingIds.length > 0
    ? await supabase.from("tour_batch_bookings").select("booking_id, batch_id").in("booking_id", allBookingIds)
    : { data: [] };

  const batchIds = (allBatchBookings ?? []).map((bb) => bb.batch_id);
  const { data: allBatches } = batchIds.length > 0
    ? await supabase.from("tour_batches").select("id, tour_guide_id, guide_payment_status, guide_payment_ref, guide_paid_at, schedule_id").in("id", batchIds)
    : { data: [] };

  // Build bookingId → batch map
  const batchMap: Record<string, any> = Object.fromEntries((allBatches ?? []).map((b) => [b.id, b]));
  const bookingBatchMap: Record<string, any> = {};
  for (const bb of allBatchBookings ?? []) {
    const batch = batchMap[bb.batch_id];
    if (batch) bookingBatchMap[bb.booking_id] = batch;
  }

  // Guide profile map
  const guideProfileMap = Object.fromEntries((guideProfiles ?? []).map((p) => [p.id, p]));

  // Tracking
  const { data: allTracking } = allBookingIds.length > 0
    ? await supabase.from("tour_passenger_tracking").select("booking_id, passenger_id, status").in("booking_id", allBookingIds)
    : { data: [] };

  const trackingSummary: Record<string, { picked_up: number; on_tour: number; dropped_off: number; no_show: number; waiting: number }> = {};
  for (const t of allTracking ?? []) {
    if (!trackingSummary[t.booking_id]) {
      trackingSummary[t.booking_id] = { picked_up: 0, on_tour: 0, dropped_off: 0, no_show: 0, waiting: 0 };
    }
    const s = t.status as string;
    if (s === "picked_up")        trackingSummary[t.booking_id].picked_up++;
    else if (s === "on_tour")     trackingSummary[t.booking_id].on_tour++;
    else if (s === "dropped_off") trackingSummary[t.booking_id].dropped_off++;
    else if (s === "no_show")     trackingSummary[t.booking_id].no_show++;
    else                          trackingSummary[t.booking_id].waiting++;
  }

  // Today's revenue (all sources — for hero banner)
  const { data: todayRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "verified")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayRevenue = (todayRevData ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);

  const { count: totalBookings } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed");

  const { data: profile } = await supabase
    .from("profiles").select("full_name").eq("id", user.id).single();

  const displayName = profile?.full_name ?? user.email ?? "Operator";

  // Serialize bookings for client
  const bookingsWithMeta = (allBookings ?? []).map((b) => {
    const batch = bookingBatchMap[b.id] ?? null;
    const guideId = batch?.tour_guide_id ?? null;
    return {
      id: b.id,
      reference: b.reference,
      customer_name: b.customer_name,
      total_pax: b.total_pax,
      total_amount_cents: b.total_amount_cents,
      booking_type: b.booking_type,
      is_walk_in: b.is_walk_in,
      booking_source: b.booking_source ?? "online",
      status: b.status,
      schedule_date: (b.schedule as { available_date?: string } | null)?.available_date ?? null,
      departure_time: (b.schedule as { departure_time?: string } | null)?.departure_time ?? null,
      tour_title: (b.tour as { title?: string } | null)?.title ?? "—",
      guide_id: guideId,
      guide_name: guideId ? (guideProfileMap[guideId]?.full_name ?? "—") : null,
      tracking: trackingSummary[b.id] ?? null,
    };
  });

  // Revenue bookings for the audit sections
  const revenueBookingsForClient = (revenueBookings ?? []).map((b) => {
    const batch = bookingBatchMap[b.id] ?? null;
    const guideId = batch?.tour_guide_id ?? null;
    return {
      id: b.id,
      reference: b.reference,
      total_amount_cents: b.total_amount_cents,
      booking_source: b.booking_source ?? "online",
      payment_verified_at: b.payment_verified_at ?? null,
      operator_payment_status: b.operator_payment_status ?? "pending",
      operator_payment_ref: b.operator_payment_ref ?? null,
      operator_paid_at: b.operator_paid_at ?? null,
      customer_name: b.customer_name,
      total_pax: b.total_pax,
      tour_title: (b.tour as { title?: string } | null)?.title ?? "—",
      schedule_date: (b.schedule as { available_date?: string } | null)?.available_date ?? null,
      // Guide payment (from batch)
      guide_id: guideId,
      guide_name: guideId ? (guideProfileMap[guideId]?.full_name ?? "—") : null,
      guide_payment_status: batch?.guide_payment_status ?? "pending",
      guide_payment_ref: batch?.guide_payment_ref ?? null,
      guide_paid_at: batch?.guide_paid_at ?? null,
      batch_id: batch?.id ?? null,
    };
  });

  return (
    <TourOperatorDashboardClient
      displayName={displayName}
      totalBookings={totalBookings ?? 0}
      guidesCount={myGuides.length}
      todayRevenue={todayRevenue}
      pendingCount={pendingCount ?? 0}
      bookings={bookingsWithMeta}
      revenueBookings={revenueBookingsForClient}
      guides={myGuides.map((g) => ({
        id: g.id,
        full_name: g.guide?.full_name ?? "—",
        email: g.guide?.email ?? "—",
        mobile: g.guide?.mobile ?? null,
      }))}
      todayPH={todayPH}
    />
  );
}
