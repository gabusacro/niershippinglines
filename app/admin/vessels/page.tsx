import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { AddVesselForm } from "./AddVesselForm";
import { DeleteVesselButton } from "./DeleteVesselButton";
import { FleetClient } from "@/components/admin/fleet/FleetClient";

export const metadata = {
  title: "Fleet & Schedule",
  description: "Manage vessels, routes, and schedules — Travela Siargao",
};

export const dynamic = "force-dynamic";

export default async function AdminVesselsPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);

  const isAdmin = user.role === "admin";
  const isCaptain = user.role === "captain";
  if (!isAdmin && !isCaptain) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  // Get all boats
  let boatsQuery = supabase
    .from("boats")
    .select("id, name, capacity, online_quota, status, image_url, marina_number")
    .order("name");

  // Captains only see their assigned boats
  let captainBoatIds: string[] | null = null;
  if (isCaptain) {
    const { data: assignments } = await supabase
      .from("boat_assignments")
      .select("boat_id")
      .eq("profile_id", user.id);
    captainBoatIds = (assignments ?? []).map((a) => a.boat_id);
    if (captainBoatIds.length === 0) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-[#134e4a]">Fleet & Schedule</h1>
          <p className="mt-4 text-sm text-[#0f766e]">You are not assigned to any vessel yet. Ask an admin to assign you.</p>
          <Link href={ROUTES.dashboard} className="mt-4 inline-block text-sm font-semibold text-[#0c7b93] hover:underline">← Dashboard</Link>
        </div>
      );
    }
  }

  const { data: boats } = await boatsQuery;
  const filteredBoats = isCaptain && captainBoatIds
    ? (boats ?? []).filter((b) => captainBoatIds!.includes(b.id))
    : (boats ?? []);

  const boatIds = filteredBoats.map((b) => b.id);

  // Get route assignments with schedule slots for all boats
  const { data: routeAssignments } = await supabase
    .from("vessel_route_assignments")
    .select(`
      id, boat_id, route_id, available_from, available_until, is_active,
      routes:route_id (id, origin, destination, display_name),
      schedule_slots (id, departure_time, slot_label, estimated_travel_minutes, is_active)
    `)
    .in("boat_id", boatIds.length > 0 ? boatIds : ["00000000-0000-0000-0000-000000000000"])
    .order("available_from", { ascending: true });

  // Get crew assignments with profile names
  const { data: crewAssignments } = await supabase
    .from("boat_assignments")
    .select("id, boat_id, profile_id, assignment_role, profiles:profile_id (full_name)")
    .in("boat_id", boatIds.length > 0 ? boatIds : ["00000000-0000-0000-0000-000000000000"]);

  // Get upcoming trip counts and confirmed passenger counts
  const { data: upcomingTrips } = await supabase
    .from("trips")
    .select("id, boat_id")
    .in("boat_id", boatIds.length > 0 ? boatIds : ["00000000-0000-0000-0000-000000000000"])
    .gte("departure_date", today);

  const tripIds = (upcomingTrips ?? []).map((t) => t.id);
  const confirmedByBoat = new Map<string, number>();

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count")
      .in("trip_id", tripIds)
      .in("status", ["confirmed", "checked_in", "boarded", "completed"]);

    const tripToBoat = new Map<string, string>();
    for (const t of upcomingTrips ?? []) tripToBoat.set(t.id, t.boat_id);

    for (const b of bookings ?? []) {
      const boatId = tripToBoat.get(b.trip_id);
      if (boatId) {
        confirmedByBoat.set(boatId, (confirmedByBoat.get(boatId) ?? 0) + (b.passenger_count ?? 0));
      }
    }
  }

  const tripCountByBoat = new Map<string, number>();
  for (const t of upcomingTrips ?? []) {
    tripCountByBoat.set(t.boat_id, (tripCountByBoat.get(t.boat_id) ?? 0) + 1);
  }

  // Get all routes for the assign modal
  const { data: routes } = await supabase
    .from("routes")
    .select("id, origin, destination, display_name")
    .order("display_name");

  // Build vessel objects
  const vessels = filteredBoats.map((boat) => {
    const boatAssignments = (routeAssignments ?? []).filter((a) => a.boat_id === boat.id);
    const boatCrew = (crewAssignments ?? [])
      .filter((c) => c.boat_id === boat.id)
      .map((c) => ({
        id: c.id,
        profile_id: c.profile_id,
        assignment_role: c.assignment_role,
        full_name: (c.profiles as { full_name?: string | null } | null)?.full_name ?? null,
      }));

    return {
      id: boat.id,
      name: boat.name,
      capacity: boat.capacity,
      online_quota: boat.online_quota,
      status: boat.status,
      image_url: boat.image_url ?? null,
      marina_number: boat.marina_number ?? null,
      upcomingTripCount: tripCountByBoat.get(boat.id) ?? 0,
      confirmedPassengers: confirmedByBoat.get(boat.id) ?? 0,
      routeAssignments: boatAssignments.map((a) => ({
        id: a.id,
        boat_id: a.boat_id,
        route_id: a.route_id,
        available_from: a.available_from,
        available_until: a.available_until,
        is_active: a.is_active,
        routes: (Array.isArray(a.routes) ? a.routes[0] : a.routes) as { id: string; origin: string; destination: string; display_name: string },
        schedule_slots: (a.schedule_slots as Array<{
          id: string;
          departure_time: string;
          slot_label: string | null;
          estimated_travel_minutes: number;
          is_active: boolean;
        }>) ?? [],
      })),
      crew: boatCrew,
    };
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">🚢 Fleet & Schedule</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            {isAdmin
              ? "Manage vessels, assign routes with departure times, and set availability dates. Trips are auto-generated per assigned date range."
              : "Your assigned vessel(s) and their schedules."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && <AddVesselForm />}
          <Link
            href={ROUTES.dashboard}
            className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50"
          >
            ← Dashboard
          </Link>
          {isAdmin && (
            <Link
              href={ROUTES.adminSchedule}
              className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50"
            >
              Manage Routes
            </Link>
          )}
        </div>
      </div>

      {/* Legend */}
      {isAdmin && (
        <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/50 px-5 py-4">
          <p className="text-xs font-semibold text-[#0f766e] uppercase tracking-wide mb-2">How it works</p>
          <div className="grid sm:grid-cols-3 gap-3 text-xs text-[#134e4a]">
            <div className="flex gap-2">
              <span>1️⃣</span>
              <span><strong>Assign a route</strong> to a vessel with availability dates (e.g. Feb 1 – Feb 28)</span>
            </div>
            <div className="flex gap-2">
              <span>2️⃣</span>
              <span><strong>Add departure times</strong> — each becomes a daily trip. Add multiple for multi-trip days.</span>
            </div>
            <div className="flex gap-2">
              <span>3️⃣</span>
              <span><strong>Trips are auto-generated</strong> for every day. Set to Maintenance to hide from passengers.</span>
            </div>
          </div>
        </div>
      )}

      {/* Fleet List */}
      <FleetClient vessels={vessels} routes={routes ?? []} />
    </div>
  );
}
