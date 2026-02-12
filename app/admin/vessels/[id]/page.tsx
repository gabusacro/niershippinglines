import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import VesselEditForm from "./VesselEditForm";
import VesselAddTripsForm from "./VesselAddTripsForm";
import { TripsTableWithBulkActions } from "./TripsTableWithBulkActions";
import { PastTripsTable } from "./PastTripsTable";
import { DeleteVesselButton } from "../DeleteVesselButton";
import { CollapsibleSection } from "./CollapsibleSection";
import { VesselAnnouncementsSection } from "./VesselAnnouncementsSection";

export const metadata = {
  title: "Edit vessel",
  description: "Edit vessel — Nier Shipping Lines",
};

export const dynamic = "force-dynamic";

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

  const { data: upcomingTrips } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, status, online_quota, online_booked, walk_in_booked, route:routes(id, display_name, origin, destination)")
    .eq("boat_id", id)
    .gte("departure_date", today)
    .order("departure_date")
    .order("departure_time")
    .limit(90);

  const { data: pastTrips } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, status, online_quota, online_booked, walk_in_booked, route:routes(id, display_name, origin, destination)")
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
    // ports table may not exist until migration 010
  }

  const allTripIds = [...(upcomingTrips ?? []).map((t) => t.id), ...(pastTrips ?? []).map((t) => t.id)];
  const confirmedByTrip = new Map<string, number>();
  if (allTripIds.length > 0) {
    const { data: confirmedBookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count")
      .in("trip_id", allTripIds)
      .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
    for (const b of confirmedBookings ?? []) {
      confirmedByTrip.set(b.trip_id, (confirmedByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
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

  const totalConfirmed = [...(upcomingTrips ?? []), ...(pastTrips ?? [])].reduce((s, t) => s + (confirmedByTrip.get(t.id) ?? 0), 0);
  const futureConfirmed = (upcomingTrips ?? []).reduce((s, t) => s + (confirmedByTrip.get(t.id) ?? 0), 0);

  const tripCount = (upcomingTrips?.length ?? 0) + (pastTrips?.length ?? 0);

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

      {/* Upcoming trips — shown first so admin sees trip count and confirmed passengers */}
      <section className="mt-6">
        <h2 className="text-lg font-semibold text-[#134e4a]">Upcoming trips</h2>
        <p className="mt-1 text-sm text-[#0f766e]">
          Trips with 0 confirmed passengers can be removed. Trips with confirmed passengers cannot be deleted—reassign those bookings first.
        </p>
        {(upcomingTrips?.length ?? 0) + (pastTrips?.length ?? 0) > 0 && (
          <p className="mt-2 text-sm font-medium text-amber-800">
            {(upcomingTrips?.length ?? 0) + (pastTrips?.length ?? 0)} trip{((upcomingTrips?.length ?? 0) + (pastTrips?.length ?? 0)) !== 1 ? "s" : ""} total
            {pastTrips && pastTrips.length > 0 && ` (${pastTrips.length} past)`}
            {" · "}
            {futureConfirmed} confirmed on future trips — {futureConfirmed > 0 ? "reassign/refund to delete vessel" : "vessel can be deleted"}
          </p>
        )}
        {upcomingTrips && upcomingTrips.length > 0 ? (
          <TripsTableWithBulkActions
            boatId={boat.id}
            trips={upcomingTrips.map((t) => {
              const route = t.route as { display_name?: string } | null;
              const avail = (t.online_quota ?? 0) - (t.online_booked ?? 0);
              const confirmedCount = confirmedByTrip.get(t.id) ?? 0;
              return {
                id: t.id,
                routeLabel: route?.display_name ?? "—",
                departureDate: t.departure_date,
                departureTime: formatTime(t.departure_time),
                status: t.status,
                avail,
                onlineQuota: t.online_quota ?? 0,
                confirmedCount,
              };
            })}
            totalConfirmed={totalConfirmed}
          />
        ) : (
          <p className="mt-4 text-sm text-[#0f766e]">No upcoming trips. Use the form below to assign a route and date range.</p>
        )}
        {pastTrips && pastTrips.length > 0 && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-[#134e4a]">Past trips</h3>
            <p className="mt-0.5 text-xs text-[#0f766e]">
              Past trips can be removed even with no-show passengers. Only current/future confirmed tickets block vessel delete.
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
        description="Post schedule or trip updates for passengers. They appear on the Schedule and Book pages."
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
            description="Assign this vessel to one route for a date range. It cannot be on another route for the same dates."
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
            description="Add another route and date range—e.g. the return leg (Siargao → Surigao) for the same period, or a different period. One vessel can have multiple blocks (outbound + return, or different dates). Vessel cannot overlap with another route on the same dates."
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
