import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Trips — View manifests",
  description: "Trips for this vessel and month — open a trip to view its passenger manifest.",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function ReportsTripsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; boatId?: string; vessel?: string }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const year = params.year ? parseInt(params.year, 10) : null;
  const month = params.month ? parseInt(params.month, 10) : null;
  const boatId = params.boatId ?? null;
  const vesselName = params.vessel ?? "Vessel";

  if (year == null || month == null || boatId == null || month < 1 || month > 12) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href={ROUTES.adminReports} className="text-sm font-semibold text-[#0c7b93] hover:underline">
          ← Back to Reports
        </Link>
        <p className="mt-4 text-[#134e4a]">Missing or invalid year, month, or vessel. Use the &quot;By month & vessel&quot; table on Reports and click a row to view trips and manifests.</p>
      </div>
    );
  }

  const monthStr = String(month).padStart(2, "0");
  const start = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  const supabase = await createClient();
  const { data: trips, error } = await supabase
    .from("trips")
    .select("id, departure_date, departure_time, route:routes(display_name, origin, destination)")
    .eq("boat_id", boatId)
    .gte("departure_date", start)
    .lte("departure_date", end)
    .order("departure_date")
    .order("departure_time");

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href={ROUTES.adminReports} className="text-sm font-semibold text-[#0c7b93] hover:underline">
          ← Back to Reports
        </Link>
        <p className="mt-4 text-red-600">Failed to load trips.</p>
      </div>
    );
  }

  const monthName = MONTH_NAMES[month - 1];
  const list = (trips ?? []).map((t) => {
    const route = t.route as { display_name?: string; origin?: string; destination?: string } | null;
    const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
    return {
      id: t.id,
      date: (t as { departure_date?: string }).departure_date ?? "—",
      time: (t as { departure_time?: string }).departure_time ?? "—",
      routeName,
    };
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href={ROUTES.adminReports} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Back to Reports
      </Link>
      <h1 className="mt-4 text-xl font-bold text-[#134e4a]">
        Trips — {vesselName} · {monthName} {year}
      </h1>
      <p className="mt-1 text-sm text-[#0f766e]/80">
        Click a trip to open its passenger manifest (Coast Guard).
      </p>

      {list.length === 0 ? (
        <p className="mt-6 text-sm text-[#134e4a]">No trips found for this vessel in this month.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              {list.map((trip) => (
                <tr key={trip.id} className="hover:bg-teal-50/50">
                  <td className="px-4 py-2 text-[#134e4a]">{trip.date}</td>
                  <td className="px-4 py-2 text-[#134e4a]">{trip.time}</td>
                  <td className="px-4 py-2 text-[#134e4a]">{trip.routeName}</td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/reports/trip/${trip.id}`}
                      className="font-semibold text-[#0c7b93] hover:underline"
                    >
                      View manifest
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
