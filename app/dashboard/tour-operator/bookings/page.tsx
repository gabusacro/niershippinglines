import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import OperatorBookingsClient from "./OperatorBookingsClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "My Bookings — Tour Operator" };

export default async function OperatorBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const { status, view } = await searchParams;

  const supabase = await createClient();

  // All bookings assigned to this operator
  const { data: allBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .order("created_at", { ascending: false });

  // All batches for this operator
  const { data: allBatches } = await supabase
    .from("tour_batches")
    .select("id, tour_guide_id, schedule_id, batch_name, max_pax, batch_date, batch_number, guide_payment_status, service_fee_cents")
    .eq("tour_operator_id", user.id);

  // Batch bookings
  const batchIds = (allBatches ?? []).map(b => b.id);
  const { data: batchBookings } = batchIds.length > 0
    ? await supabase
        .from("tour_batch_bookings")
        .select("booking_id, batch_id")
        .in("batch_id", batchIds)
    : { data: [] };

  // Guide profiles
  const guideIds = [...new Set((allBatches ?? []).map(b => b.tour_guide_id).filter(Boolean))];
  const { data: guideProfiles } = guideIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", guideIds)
    : { data: [] };

  // My assigned guides (for assigning)
  const { data: myGuideAssignments } = await supabase
    .from("tour_guide_assignments")
    .select("tour_guide_id")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  const myGuideIds = (myGuideAssignments ?? []).map(g => g.tour_guide_id);
  const { data: myGuideProfiles } = myGuideIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", myGuideIds)
    : { data: [] };

  const guideMap = Object.fromEntries((guideProfiles ?? []).map(p => [p.id, p.full_name ?? "—"]));

  // Build booking→batch map
  const bookingBatchMap: Record<string, string> = {};
  for (const bb of batchBookings ?? []) {
    bookingBatchMap[bb.booking_id] = bb.batch_id;
  }

  const batchMap = Object.fromEntries((allBatches ?? []).map(b => [b.id, b]));

  // Serialize for client
  const bookingsForClient = (allBookings ?? []).map(b => ({
    id: b.id,
    reference: b.reference,
    customer_name: b.customer_name,
    total_pax: b.total_pax,
    total_amount_cents: b.total_amount_cents,
    status: b.status,
    payment_status: b.payment_status,
    booking_source: b.booking_source ?? "online",
    is_walk_in: b.is_walk_in ?? false,
    created_at: b.created_at,
    tour_title: (b.tour as { title?: string } | null)?.title ?? "—",
    schedule_date: (b.schedule as { available_date?: string } | null)?.available_date ?? null,
    departure_time: (b.schedule as { departure_time?: string } | null)?.departure_time ?? null,
    schedule_id: b.schedule_id ?? null,
    batch_id: bookingBatchMap[b.id] ?? null,
    guide_id: bookingBatchMap[b.id] ? (batchMap[bookingBatchMap[b.id]]?.tour_guide_id ?? null) : null,
    guide_name: bookingBatchMap[b.id]
      ? (guideMap[batchMap[bookingBatchMap[b.id]]?.tour_guide_id ?? ""] ?? null)
      : null,
  }));

  const batchesForClient = (allBatches ?? []).map(b => ({
    id: b.id,
    schedule_id: b.schedule_id,
    batch_name: b.batch_name ?? null,
    batch_date: b.batch_date ?? null,
    batch_number: b.batch_number ?? 1,
    max_pax: b.max_pax ?? 13,
    tour_guide_id: b.tour_guide_id ?? null,
    guide_name: b.tour_guide_id ? (guideMap[b.tour_guide_id] ?? null) : null,
    guide_payment_status: b.guide_payment_status ?? "pending",
    service_fee_cents: b.service_fee_cents ?? 0,
    booking_ids: (batchBookings ?? []).filter(bb => bb.batch_id === b.id).map(bb => bb.booking_id),
  }));

  const myGuides = (myGuideProfiles ?? []).map(p => ({ id: p.id, full_name: p.full_name ?? "—" }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/dashboard/tour-operator" className="hover:underline">Dashboard</Link>
        <span>/</span>
        <span className="font-semibold">My Bookings</span>
      </div>

      <OperatorBookingsClient
        bookings={bookingsForClient}
        batches={batchesForClient}
        myGuides={myGuides}
        initialStatus={status ?? "all"}
        initialView={(view === "batches" ? "batches" : "list") as "list" | "batches"}
        operatorId={user.id}
      />
    </div>
  );
}
