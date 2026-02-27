import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import VesselEditForm from "./VesselEditForm";
import VesselAddTripsForm from "./VesselAddTripsForm";
import { TripsTableWithBulkActions } from "./TripsTableWithBulkActions";
import { PastTripsTable, type PastTrip } from "./PastTripsTable";
import { DeleteVesselButton } from "../DeleteVesselButton";
import { CollapsibleSection } from "./CollapsibleSection";
import { VesselAnnouncementsSection } from "./VesselAnnouncementsSection";

export const metadata = {
  title: "Edit vessel",
  description: "Edit vessel — Travela Siargao",
};

export const dynamic = "force-dynamic";

const CONFIRMED_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

export default async function AdminVesselEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);

  const { id } = await params;
  const today = new Date().toISOString().slice(0, 10);
  const supabase = await createClient();

  const { data: boat, error } = await supabase
    .from("boats")
    .select("id, name, capacity, online_quota, status, image_url")
    .eq("id", id)
    .single();

  if (error || !boat) notFound();

  let assignments: { id: string; profile_id: string; assignment_role: string }[] = [];
  try {
    const res = await supabase
      .from("boat_assignments")
      .select("id, profile_id, assignment_role")
      .eq("boat_id", id);
    assignments = res.data ?? [];
  } catch {
    // Table may not exist until migration 007
  }

  const isAdmin = user.role === "admin";
  const isCaptain = user.role === "captain";
  const captainAssigned = isCaptain && assignments.some((a) => a.profile_id === user.id);
  if (!isAdmin && !(isCaptain && captainAssigned)) {
    redirect(ROUTES.dashboard);
  }

  // Fuel settings for net revenue calculation
  const { data: appSettings } = await supabase
    .from("app_settings")
    .select("default_fuel_liters_per_trip, fuel_pesos_per_liter")
    .eq("id", 1)
    .maybeSingle();
  const fuelLitersPerTrip = appSettings?.default_fuel_liters_per_trip ?? 50;
  const fuelPesosPerLiter = Number(appSettings?.fuel_pesos_per_liter ?? 61.40);
  const fuelCostPerTrip = Math.round(fuelLitersPerTrip * fuelPesosPerLiter * 100);

  const { data: upcomingTrips } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, status, online_quota, online_booked, walk_in_quota, walk_in_booked, route:routes(id, display_name, origin, destination)")
    .eq("boat_id", id)
    .gte("departure_date", today)
    .order("departure_date")
    .order("departure_time")
    .limit(90);

  const { data: pastTripsRaw } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, status, online_quota, online_booked, walk_in_quota, walk_in_booked, route:routes(id, display_name, origin, destination)")
    .eq("boat_id", id)
    .lt("departure_date", today)
    .order("departure_date", { ascending: false })
    .order("departure_time", { ascending: false })
    .limit(30);

  const { data: routes } = await supabase
    .from("routes")
    .select("id, display_name, origin, destination")
    .order("display_name");

  let ports: { id: string; name: string }[] = [];
  try {
    const res = await supabase.from("ports").select("id, name").order("name");
    ports = res.data ?? [];
  } catch {
    // ports table may not exist
  }

  // Get all trip IDs
  const pastTripIds = (pastTripsRaw ?? []).map((t) => t.id);
  const allTripIds = [...(upcomingTrips ?? []).map((t) => t.id), ...pastTripIds];

  // Booking aggregates for ALL trips (confirmed passengers count)
  const confirmedByTrip = new Map<string, number>();

  // Financial aggregates for PAST trips only
  type TripFinancials = {
    passengers: number;
    grossFareCents: number;
    platformFeeCents: number;
    paymentProcessingCents: number;
  };
  const financialsByTrip = new Map<string, TripFinancials>();

  if (allTripIds.length > 0) {
    const { data: confirmedBookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", allTripIds)
      .in("status", CONFIRMED_STATUSES);

    for (const b of confirmedBookings ?? []) {
      // Confirmed count for all trips
      confirmedByTrip.set(b.trip_id, (confirmedByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));

      // Financials for past trips
      if (pastTripIds.includes(b.trip_id)) {
        const cur = financialsByTrip.get(b.trip_id) ?? { passengers: 0, grossFareCents: 0, platformFeeCents: 0, paymentProcessingCents: 0 };
        cur.passengers += b.passenger_count ?? 0;
        cur.grossFareCents += b.total_amount_cents ?? 0;
        cur.platformFeeCents += b.admin_fee_cents ?? 0;
        cur.paymentProcessingCents += b.gcash_fee_cents ?? 0;
        financialsByTrip.set(b.trip_id, cur);
      }
    }
  }

  // Fetch payment status for past trips from trip_fare_payments
  const paymentStatusByTrip = new Map<string, { status: "pending" | "paid" | "failed"; reference: string | null }>();
  if (pastTripIds.length > 0) {
    try {
      const { data: farePayments } = await supabase
        .from("trip_fare_payments")
        .select("trip_id, status, payment_reference")
        .in("trip_id", pastTripIds);

      for (const p of farePayments ?? []) {
        paymentStatusByTrip.set(p.trip_id, {
          status: p.status as "pending" | "paid" | "failed",
          reference: p.payment_reference ?? null,
        });
      }
    } catch {
      // trip_fare_payments may not exist yet — run migration first
    }
  }

  function formatTime(t: string | null | undefined): string {
    if (!t) return "—";
    const s = String(t).slice(0, 5);
    const [h, m] = s.split(":");
    const hh = parseInt(h ?? "0", 10);
    const am = hh < 12;
    const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
    return `${h12}:${m ?? "00"} ${am ? "AM" : "PM"}`;
  }

  // Build past trips with financial data
  const pastTrips: PastTrip[] = (pastTripsRaw ?? []).map((t) => {
    const route = Array.isArray((t as { route?: unknown }).route)
      ? ((t as { route: unknown[] }).route[0] as { display_name?: string } | null)
      : ((t as { route?: { display_name?: string } | null }).route ?? null);

    const fin = financialsByTrip.get(t.id) ?? { passengers: 0, grossFareCents: 0, platformFeeCents: 0, paymentProcessingCents: 0 };
    const payment = paymentStatusByTrip.get(t.id) ?? { status: "pending" as const, reference: null };

    return {
      id: t.id,
      departure_date: t.departure_date,
      departure_time: t.departure_time ?? null,
      route: route && typeof route === "object" ? { display_name: route.display_name } : null,
      passengers: fin.passengers,
      grossFareCents: fin.grossFareCents,
      platformFeeCents: fin.platformFeeCents,
      paymentProcessingCents: fin.paymentProcessingCents,
      fuelCostCents: fuelCostPerTrip,
      paymentStatus: payment.status,
      paymentReference: payment.reference,
    };
  });

  const totalConfirmed = [...(upcomingTrips ?? []), ...pastTrips].reduce((s, t) => s + (confirmedByTrip.get(t.id) ?? 0), 0);
  const futureConfirmed = (upcomingTrips ?? []).reduce((s, t) => s + (confirmedByTrip.get(t.id) ?? 0), 0);
  const tripCount = (upcomingTrips?.length ?? 0) + pastTrips.length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">Manage vessel — {boat.name}</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Edit details, assign schedule, or manage trips. Only <strong>confirmed</strong> passengers block deletion.
          </p>
        </div>
        {isAdmin && (
          <DeleteVesselButton
            vesselId={boat.id}
            vesselName={boat.name}
            tripCount={tripCount}
            bookedCount={futureConfirmed}
          />
        )}
      </div>

      {/* Upcoming trips */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-[#134e4a]">Upcoming trips</h2>
        <p className="mt-1 text-sm text-[#0f766e]">
          Trips with 0 confirmed passengers can be removed.
        </p>
        {tripCount > 0 && (
          <p className="mt-2 text-sm font-medium text-amber-800">
            {tripCount} trip{tripCount !== 1 ? "s" : ""} total
            {pastTrips.length > 0 && ` (${pastTrips.length} past)`}
            {" · "}
            {futureConfirmed} confirmed on future trips —{" "}
            {futureConfirmed > 0 ? "reassign/refund to delete vessel" : "vessel can be deleted"}
          </p>
        )}
        {(upcomingTrips?.length ?? 0) > 0 ? (
          <TripsTableWithBulkActions
            boatId={boat.id}
            trips={upcomingTrips!.map((t) => {
              const route = t.route as { display_name?: string } | null;
              const ob = t.online_booked ?? 0;
              const wb = t.walk_in_booked ?? 0;
              const capacity = boat.capacity ?? (t.online_quota ?? 0) + (t.walk_in_quota ?? 0);
              const avail = Math.max(0, capacity - ob - wb);
              return {
                id: t.id,
                routeLabel: route?.display_name ?? "—",
                departureDate: t.departure_date,
                departureTime: formatTime(t.departure_time),
                status: t.status,
                avail,
                totalBooked: ob + wb,
                capacity,
                onlineQuota: t.online_quota ?? 0,
                confirmedCount: confirmedByTrip.get(t.id) ?? 0,
              };
            })}
            totalConfirmed={totalConfirmed}
          />
        ) : (
          <p className="mt-4 text-sm text-[#0f766e]">No upcoming trips. Use the form below to add trips.</p>
        )}

        {/* Past trips with payment tracking */}
        {pastTrips.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-[#134e4a]">Past trips & fare payments</h3>
            <p className="mt-0.5 text-xs text-[#0f766e]">
              Mark each trip as paid after transferring the gross fare to the vessel owner. Platform fees are deducted from the payout shown.
            </p>
            <PastTripsTable
              boatId={boat.id}
              trips={pastTrips}
              confirmedByTrip={Object.fromEntries(confirmedByTrip)}
            />
          </div>
        )}
      </section>

      <CollapsibleSection
        title="Announcements & updates"
        description="Post schedule or trip updates for passengers."
      >
        <VesselAnnouncementsSection
          boatId={boat.id}
          boatName={boat.name}
          isAdmin={isAdmin}
          currentUserId={user.id}
        />
      </CollapsibleSection>

      {isAdmin && (
        <>
          <CollapsibleSection
            title="Vessel details & assign schedule"
            description="Assign this vessel to one route for a date range."
          >
            <VesselEditForm
              boatId={boat.id}
              initialName={boat.name}
              initialCapacity={boat.capacity}
              initialOnlineQuota={boat.online_quota}
              initialStatus={boat.status}
              initialImageUrl={boat.image_url}
              assignments={assignments}
              routes={routes ?? []}
              ports={ports}
            />
          </CollapsibleSection>

          <CollapsibleSection
            title="Add more trips"
            description="Add another route and date range."
          >
            <VesselAddTripsForm boatId={boat.id} routes={routes ?? []} ports={ports} />
          </CollapsibleSection>
        </>
      )}

      <div className="mt-8">
        <Link href={ROUTES.adminVessels} className="text-sm font-semibold text-[#0c7b93] hover:underline">
          ← Back to vessels
        </Link>
      </div>
    </div>
  );
}
