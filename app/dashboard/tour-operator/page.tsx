import { redirect } from "next/navigation";
import Link from "next/link";
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

  // My pending bookings
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "pending");

  // All upcoming confirmed bookings (next 30 days)
  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(50);

  // All bookings for status view (last 90 days + upcoming)
  const { data: allBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: false })
    .limit(100);

  // Get all booking IDs for tracking
  const allBookingIds = (allBookings ?? []).map((b) => b.id);

  // Get batch → guide mapping for all bookings
  const { data: allBatchBookings } = allBookingIds.length > 0
    ? await supabase
        .from("tour_batch_bookings")
        .select("booking_id, batch_id")
        .in("booking_id", allBookingIds)
    : { data: [] };

  const batchIds = (allBatchBookings ?? []).map((bb) => bb.batch_id);
  const { data: allBatches } = batchIds.length > 0
    ? await supabase
        .from("tour_batches")
        .select("id, tour_guide_id")
        .in("id", batchIds)
    : { data: [] };

  // Build bookingId → guideId map
  const batchMap = Object.fromEntries((allBatches ?? []).map((b) => [b.id, b]));
  const bookingGuideMap: Record<string, string> = {};
  for (const bb of allBatchBookings ?? []) {
    const batch = batchMap[bb.batch_id];
    if (batch?.tour_guide_id) bookingGuideMap[bb.booking_id] = batch.tour_guide_id;
  }

  // Get tracking for all bookings
  const { data: allTracking } = allBookingIds.length > 0
    ? await supabase
        .from("tour_passenger_tracking")
        .select("booking_id, passenger_id, status")
        .in("booking_id", allBookingIds)
    : { data: [] };

  // Build bookingId → { picked_up, on_tour, dropped_off, no_show, waiting } counts
  const trackingSummary: Record<string, { picked_up: number; on_tour: number; dropped_off: number; no_show: number; waiting: number }> = {};
  for (const t of allTracking ?? []) {
    if (!trackingSummary[t.booking_id]) {
      trackingSummary[t.booking_id] = { picked_up: 0, on_tour: 0, dropped_off: 0, no_show: 0, waiting: 0 };
    }
    const s = t.status as string;
    if (s === "picked_up")   trackingSummary[t.booking_id].picked_up++;
    else if (s === "on_tour")     trackingSummary[t.booking_id].on_tour++;
    else if (s === "dropped_off") trackingSummary[t.booking_id].dropped_off++;
    else if (s === "no_show")     trackingSummary[t.booking_id].no_show++;
    else trackingSummary[t.booking_id].waiting++;
  }

  // Guide profile map
  const guideProfileMap = Object.fromEntries((guideProfiles ?? []).map((p) => [p.id, p]));

  // Today's revenue
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
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name ?? user.email ?? "Operator";

  // Serialize for client component
  const bookingsWithMeta = (allBookings ?? []).map((b) => ({
    id: b.id,
    reference: b.reference,
    customer_name: b.customer_name,
    total_pax: b.total_pax,
    total_amount_cents: b.total_amount_cents,
    booking_type: b.booking_type,
    is_walk_in: b.is_walk_in,
    status: b.status,
    schedule_date: (b.schedule as { available_date?: string } | null)?.available_date ?? null,
    departure_time: (b.schedule as { departure_time?: string } | null)?.departure_time ?? null,
    tour_title: (b.tour as { title?: string } | null)?.title ?? "—",
    guide_id: bookingGuideMap[b.id] ?? null,
    guide_name: bookingGuideMap[b.id] ? (guideProfileMap[bookingGuideMap[b.id]]?.full_name ?? "—") : null,
    tracking: trackingSummary[b.id] ?? null,
  }));

  return (
    <TourOperatorDashboardClient
      displayName={displayName}
      totalBookings={totalBookings ?? 0}
      guidesCount={myGuides.length}
      todayRevenue={todayRevenue}
      pendingCount={pendingCount ?? 0}
      bookings={bookingsWithMeta}
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
