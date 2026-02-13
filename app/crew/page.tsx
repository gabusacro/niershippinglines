import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { getTodayInManila, isTripDeparted } from "@/lib/admin/ph-time";
import { formatTime } from "@/lib/dashboard/format";

export default async function CrewPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(user.role ?? "");
  if (!allowed) redirect(ROUTES.dashboard);

  const today = getTodayInManila();
  const supabase = await createClient();
  const { data: rawTrips } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boat:boats(name, capacity), route:routes(display_name, origin, destination)")
    .eq("departure_date", today)
    .eq("status", "scheduled")
    .order("departure_time");

  const todayTrips = (rawTrips ?? []).filter(
    (t) => !isTripDeparted(t.departure_date ?? "", t.departure_time ?? "")
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Crew</h1>
      <p className="mt-2 text-[#0f766e]">Today&apos;s trips, check-in, and ticket validation. Real-time seat availability.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href={ROUTES.crewScan}
          className="inline-flex items-center rounded-xl bg-[#0c7b93] px-6 py-4 font-semibold text-white hover:bg-[#0a6b7d]"
        >
          Scan ticket QR
        </Link>
      </div>

      {todayTrips && todayTrips.length > 0 && (
        <section className="mt-8 rounded-2xl border border-teal-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-[#134e4a]">Today&apos;s trips — real-time available seats</h2>
          <p className="mt-1 text-sm text-[#0f766e]">Capacity 150 per vessel. Available = capacity − online booked − walk-in booked.</p>
          <ul className="mt-4 space-y-3">
            {todayTrips.map((t) => {
              const boat = t.boat as { name?: string; capacity?: number } | null;
              const route = t.route as { display_name?: string; origin?: string; destination?: string } | null;
              const ob = t.online_booked ?? 0;
              const wb = t.walk_in_booked ?? 0;
              const capacity = boat?.capacity ?? 150;
              const available = Math.max(0, capacity - ob - wb);
              const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" ↔ ") ?? "—";
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-teal-200 bg-[#fef9e7]/30 px-4 py-3">
                  <div>
                    <p className="font-semibold text-[#134e4a]">{formatTime(t.departure_time)} · {boat?.name ?? "—"}</p>
                    <p className="text-sm text-[#0f766e]">{routeName}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#134e4a]">{available} seats available</p>
                    <p className="text-xs text-[#0f766e]">{ob + wb} booked (online: {ob}, walk-in: {wb}) · cap {capacity}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
