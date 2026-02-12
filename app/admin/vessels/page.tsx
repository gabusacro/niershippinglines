import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { AddVesselForm } from "./AddVesselForm";
import { DeleteVesselButton } from "./DeleteVesselButton";

export const metadata = {
  title: "Vessels",
  description: "Manage vessels — Nier Shipping Lines",
};

export default async function AdminVesselsPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isCaptain = user.role === "captain";
  if (!isAdmin && !isCaptain) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  let boatIdsAllowed: string[] | null = null;
  if (isCaptain) {
    const { data: assignments } = await supabase
      .from("boat_assignments")
      .select("boat_id")
      .eq("profile_id", user.id);
    boatIdsAllowed = (assignments ?? []).map((a) => a.boat_id);
    if (boatIdsAllowed.length === 0) {
      return (
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold text-[#134e4a]">Vessels</h1>
          <p className="mt-4 text-sm text-[#0f766e]">You are not assigned to any vessel yet. Ask an admin to assign you.</p>
          <Link href={ROUTES.dashboard} className="mt-4 inline-block text-sm font-semibold text-[#0c7b93] hover:underline">← Dashboard</Link>
        </div>
      );
    }
  }

  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, capacity, online_quota, status")
    .order("name");

  const boatsList = isCaptain && boatIdsAllowed
    ? (boats ?? []).filter((b) => boatIdsAllowed!.includes(b.id))
    : (boats ?? []);

  const { data: tripStats } = await supabase
    .from("trips")
    .select("id, boat_id")
    .gte("departure_date", today);
  const tripIds = (tripStats ?? []).map((t) => t.id);
  const statsByBoat = new Map<string, { tripCount: number; bookedCount: number }>();
  for (const t of tripStats ?? []) {
    const cur = statsByBoat.get(t.boat_id) ?? { tripCount: 0, bookedCount: 0 };
    statsByBoat.set(t.boat_id, { tripCount: cur.tripCount + 1, bookedCount: cur.bookedCount });
  }
  if (tripIds.length > 0) {
    const { data: confirmedBookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count")
      .in("trip_id", tripIds)
      .in("status", ["confirmed", "checked_in", "boarded", "completed"]);
    const confirmedByTrip = new Map<string, number>();
    for (const b of confirmedBookings ?? []) {
      confirmedByTrip.set(b.trip_id, (confirmedByTrip.get(b.trip_id) ?? 0) + (b.passenger_count ?? 0));
    }
    for (const t of tripStats ?? []) {
      const confirmed = confirmedByTrip.get(t.id) ?? 0;
      const cur = statsByBoat.get(t.boat_id)!;
      statsByBoat.set(t.boat_id, { ...cur, bookedCount: cur.bookedCount + confirmed });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Vessels</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        {isAdmin
          ? "Add, edit, or remove vessels. Edit vessel details and assign schedule (route, date range). Siargao = Port of Dapa; Dinagat = Loreto, Valencia, San Jose."
          : "Your assigned vessel(s). Post announcements for passengers (schedule delays, updates)."}
      </p>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {isAdmin && <AddVesselForm />}
        <Link href={ROUTES.dashboard} className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50">
          ← Dashboard
        </Link>
        {isAdmin && (
          <>
            <Link href={ROUTES.adminSchedule} className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50">
              Schedule (routes & times)
            </Link>
            <Link href={ROUTES.adminReports} className="inline-flex min-h-[44px] items-center rounded-xl border-2 border-teal-200 bg-white px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:border-[#0c7b93] hover:bg-teal-50">
              Reports
            </Link>
          </>
        )}
      </div>

      <div className="mt-8 space-y-4">
        {boatsList.length === 0 ? (
          <p className="rounded-xl border border-teal-200 bg-white p-6 text-center text-sm text-[#0f766e]">
            No vessels yet. Click &quot;+ Add vessel&quot; above to add one.
          </p>
        ) : (
          boatsList.map((b) => {
            const stats = statsByBoat.get(b.id) ?? { tripCount: 0, bookedCount: 0 };
            return (
              <div
                key={b.id}
                className="flex flex-col gap-4 rounded-xl border border-teal-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <h2 className="font-semibold text-[#134e4a]">{b.name}</h2>
                  <p className="mt-1 text-sm text-[#0f766e]">
                    Capacity {b.capacity} · Online quota {b.online_quota} · {b.status}
                  </p>
                  {stats.tripCount > 0 && (
                    <p className="mt-1 text-xs text-amber-700">
                      {stats.tripCount} upcoming trip{stats.tripCount !== 1 ? "s" : ""} · {stats.bookedCount} confirmed passenger{stats.bookedCount !== 1 ? "s" : ""}
                      {stats.bookedCount === 0 && " · Remove trips first to delete vessel"}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-3">
                  <Link
                    href={`/admin/vessels/${b.id}`}
                    className="min-h-[44px] shrink-0 rounded-xl border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors inline-flex items-center justify-center"
                  >
                    {isAdmin ? (stats.tripCount > 0 ? "Manage trips" : "Edit vessel") : "Announcements"}
                  </Link>
                  {isAdmin && (
                    <DeleteVesselButton
                      vesselId={b.id}
                      vesselName={b.name}
                      tripCount={stats.tripCount}
                      bookedCount={stats.bookedCount}
                    />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
