import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getFuelSettings } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Trips — View manifests",
  description: "Trips for a date or vessel and month — open a trip to view its passenger manifest.",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function formatTime(t: string) {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default async function ReportsTripsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    month?: string;
    date?: string;
    boatId?: string;
    vessel?: string;
  }>;
}) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.dashboard);
  const isAdmin = user.role === "admin";
  const isTicketBooth = user.role === "ticket_booth";
  if (!isAdmin && !isTicketBooth) redirect(ROUTES.dashboard);

  const params = await searchParams;
  const supabase = await createClient();
  const fuelSettings = await getFuelSettings(supabase);

  // ── MODE A: single date (from daily calendar "View →")
  const dateParam = params.date ?? null; // e.g. "2026-02-22"

  // ── MODE B: vessel + month (from monthly/yearly manifest links)
  const year = params.year ? parseInt(params.year, 10) : null;
  const month = params.month ? parseInt(params.month, 10) : null;
  const boatId = params.boatId ?? null;
  const vesselLabel = params.vessel ?? null;

  const isSingleDate = !!dateParam;
  const isVesselMonth = !isSingleDate && year != null && month != null;

  // Build query date range
  let start = "";
  let end = "";
  let pageTitle = "";
  let backHref = ROUTES.adminReports;

  if (isSingleDate) {
    start = dateParam!;
    end = dateParam!;
    const jsDate = new Date(dateParam! + "T00:00:00");
    const calYear = jsDate.getFullYear();
    const calMonth = jsDate.getMonth() + 1;
    pageTitle = jsDate.toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    backHref = `${ROUTES.adminReports}?period=daily&month=${calYear}-${String(calMonth).padStart(2, "0")}`;
  } else if (isVesselMonth && month! >= 1 && month! <= 12) {
    const monthStr = String(month).padStart(2, "0");
    start = `${year}-${monthStr}-01`;
    const lastDay = new Date(year!, month!, 0).getDate();
    end = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
    pageTitle = `${vesselLabel ?? "All vessels"} — ${MONTH_NAMES[month! - 1]} ${year}`;
    backHref = `${ROUTES.adminReports}?period=monthly`;
  } else {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href={ROUTES.adminReports} className="text-sm font-semibold text-[#0c7b93] hover:underline">
          ← Back to Reports
        </Link>
        <p className="mt-4 text-[#134e4a]">
          Missing or invalid parameters. Go back to Reports and click a date or vessel manifest link.
        </p>
      </div>
    );
  }

  // Fetch trips
  let query = supabase
    .from("trips")
    .select("id, departure_date, departure_time, online_quota, online_booked, walk_in_quota, walk_in_booked, boarded_count, boat:boats(id, name), route:routes(display_name, origin, destination)")
    .gte("departure_date", start)
    .lte("departure_date", end)
    .order("departure_date")
    .order("departure_time");

  if (boatId) {
    query = query.eq("boat_id", boatId);
  }

  const { data: trips, error } = await query;

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Link href={backHref} className="text-sm font-semibold text-[#0c7b93] hover:underline">← Back</Link>
        <p className="mt-4 text-red-600">Failed to load trips: {error.message}</p>
      </div>
    );
  }

  // Fetch bookings for all trips
  const tripIds = (trips ?? []).map((t) => t.id);
  const bookingsByTrip = new Map<string, {
    passengers: number;
    revenueCents: number;
    adminFeeCents: number;
    gcashFeeCents: number;
  }>();

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, passenger_count, total_amount_cents, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const cur = bookingsByTrip.get(b.trip_id) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
      cur.passengers += b.passenger_count ?? 0;
      cur.revenueCents += b.total_amount_cents ?? 0;
      cur.adminFeeCents += b.admin_fee_cents ?? 0;
      cur.gcashFeeCents += b.gcash_fee_cents ?? 0;
      bookingsByTrip.set(b.trip_id, cur);
    }
  }

  // Compute totals
  let totPassengers = 0, totRevenue = 0, totAdmin = 0, totGcash = 0, totFuelCost = 0;
  for (const t of trips ?? []) {
    const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
    const fuelCost = Math.round(fuelSettings.defaultFuelLitersPerTrip * fuelSettings.fuelPesosPerLiter * 100);
    totPassengers += b.passengers;
    totRevenue += b.revenueCents;
    totAdmin += b.adminFeeCents;
    totGcash += b.gcashFeeCents;
    totFuelCost += fuelCost;
  }
  const totNet = totRevenue - totFuelCost;

  // Group by date if showing multiple dates (vessel+month mode)
  const dateGroups = new Map<string, typeof trips>();
  for (const t of trips ?? []) {
    const d = t.departure_date ?? "";
    const arr = dateGroups.get(d) ?? [];
    arr.push(t);
    dateGroups.set(d, arr);
  }
  const sortedDates = [...dateGroups.keys()].sort();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Back + title */}
      <div className="flex flex-wrap items-center gap-3">
        <Link href={backHref} className="rounded-lg border border-teal-200 px-3 py-1.5 text-sm font-semibold text-[#0c7b93] hover:bg-teal-50">
          ← Back
        </Link>
        <div>
          <h1 className="text-xl font-bold text-[#134e4a]">{pageTitle}</h1>
          <p className="text-xs text-[#0f766e]/70">Click a vessel name to open the full passenger manifest.</p>
        </div>
      </div>

      {/* Summary cards */}
      {(trips ?? []).length > 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Trips", value: String(trips?.length ?? 0) },
            { label: "Passengers", value: totPassengers.toLocaleString() },
            { label: "Gross Fare", value: peso(totRevenue) },
            { label: "Admin Fees", value: peso(totAdmin), color: "text-emerald-700" },
            { label: "GCash Fees", value: peso(totGcash), color: "text-blue-700" },
            { label: "Net (Fare−Fuel)", value: peso(totNet), color: totNet < 0 ? "text-red-600" : "text-[#134e4a]" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-xl border border-teal-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-[#0f766e]">{label}</p>
              <p className={`mt-1.5 text-lg font-bold ${color ?? "text-[#134e4a]"}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* No trips */}
      {(trips ?? []).length === 0 && (
        <div className="mt-8 rounded-xl border border-teal-100 bg-white p-8 text-center shadow-sm">
          <p className="text-sm text-[#0f766e]">No trips found for this period.</p>
          <Link href={ROUTES.adminVessels} className="mt-3 inline-block text-sm font-semibold text-[#0c7b93] hover:underline">
            Go to Vessels → Add trips
          </Link>
        </div>
      )}

      {/* SINGLE DATE MODE — flat table */}
      {isSingleDate && (trips ?? []).length > 0 && (
        <div className="mt-6 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Avail</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Boarded</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel (L)</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Fuel Cost</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                <th className="px-4 py-3 text-center text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              {(trips ?? []).map((t) => {
                const boat = (t as { boat?: { id?: string; name?: string } | null }).boat;
                const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
                const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
                const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
                const fuelL = fuelSettings.defaultFuelLitersPerTrip;
                const fuelCost = Math.round(fuelL * fuelSettings.fuelPesosPerLiter * 100);
                const netRev = b.revenueCents - fuelCost;
                const avail = Math.max(0, (t.online_quota ?? 0) - (t.online_booked ?? 0) + (t.walk_in_quota ?? 0) - (t.walk_in_booked ?? 0));
                return (
                  <tr key={t.id} className="hover:bg-teal-50/40">
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/admin/reports/trip/${t.id}`} className="text-[#0c7b93] hover:underline">
                        {boat?.name ?? "—"}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-[#134e4a]">{formatTime(t.departure_time)}</td>
                    <td className="px-4 py-3 text-[#134e4a]">{routeName}</td>
                    <td className="px-4 py-3 text-right text-[#134e4a]">{avail}</td>
                    <td className="px-4 py-3 text-right text-[#134e4a]">{b.passengers}</td>
                    <td className="px-4 py-3 text-right text-[#134e4a]">{b.revenueCents > 0 ? peso(b.revenueCents) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">{b.adminFeeCents > 0 ? peso(b.adminFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>
                    <td className="px-4 py-3 text-right font-medium text-blue-700">{b.gcashFeeCents > 0 ? peso(b.gcashFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>
                    <td className="px-4 py-3 text-right text-[#134e4a]">{fuelL} L</td>
                    <td className="px-4 py-3 text-right text-red-600">{peso(fuelCost)}</td>
                    <td className={`px-4 py-3 text-right font-semibold ${netRev < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(netRev)}</td>
                    <td className="px-4 py-3 text-center">
                      <Link href={`/admin/reports/trip/${t.id}`} className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e]">
                        Manifest
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-[#134e4a]/5 font-semibold text-sm">
                <td className="px-4 py-3 text-[#134e4a]">Total</td>
                <td colSpan={3} />
                <td className="px-4 py-3 text-right text-[#134e4a]">{totPassengers}</td>
                <td className="px-4 py-3 text-right text-[#134e4a]">{peso(totRevenue)}</td>
                <td className="px-4 py-3 text-right text-emerald-700">{peso(totAdmin)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{peso(totGcash)}</td>
                <td className="px-4 py-3 text-right text-[#134e4a]">{(trips ?? []).length * fuelSettings.defaultFuelLitersPerTrip} L</td>
                <td className="px-4 py-3 text-right text-red-600">{peso(totFuelCost)}</td>
                <td className={`px-4 py-3 text-right ${totNet < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(totNet)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* VESSEL+MONTH MODE — grouped by date */}
      {!isSingleDate && sortedDates.length > 0 && (
        <div className="mt-6 space-y-6">
          {sortedDates.map((date) => {
            const dayTrips = dateGroups.get(date) ?? [];
            const jsDate = new Date(date + "T00:00:00");
            const dateLabel = jsDate.toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });

            return (
              <div key={date} className="overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
                <div className="border-b border-teal-100 bg-[#0c7b93]/5 px-4 py-2.5">
                  <p className="text-sm font-semibold text-[#134e4a]">{dateLabel}</p>
                </div>
                <table className="min-w-full divide-y divide-teal-100 text-sm">
                  <thead>
                    <tr className="bg-[#0c7b93]/5">
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Vessel</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Time</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-[#134e4a]">Route</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Boarded</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Gross Fare</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Admin Fee</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">GCash Fee</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-[#134e4a]">Net Rev</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold uppercase text-[#134e4a]">Manifest</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-100">
                    {dayTrips.map((t) => {
                      const boat = (t as { boat?: { id?: string; name?: string } | null }).boat;
                      const route = (t as { route?: { display_name?: string; origin?: string; destination?: string } | null }).route;
                      const routeName = route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—";
                      const b = bookingsByTrip.get(t.id) ?? { passengers: 0, revenueCents: 0, adminFeeCents: 0, gcashFeeCents: 0 };
                      const fuelCost = Math.round(fuelSettings.defaultFuelLitersPerTrip * fuelSettings.fuelPesosPerLiter * 100);
                      const netRev = b.revenueCents - fuelCost;
                      return (
                        <tr key={t.id} className="hover:bg-teal-50/40">
                          <td className="px-4 py-2.5 font-semibold">
                            <Link href={`/admin/reports/trip/${t.id}`} className="text-[#0c7b93] hover:underline">
                              {boat?.name ?? "—"}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 text-[#134e4a]">{formatTime(t.departure_time)}</td>
                          <td className="px-4 py-2.5 text-[#134e4a]">{routeName}</td>
                          <td className="px-4 py-2.5 text-right text-[#134e4a]">{b.passengers}</td>
                          <td className="px-4 py-2.5 text-right text-[#134e4a]">{b.revenueCents > 0 ? peso(b.revenueCents) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-emerald-700">{b.adminFeeCents > 0 ? peso(b.adminFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-blue-700">{b.gcashFeeCents > 0 ? peso(b.gcashFeeCents) : <span className="text-gray-300 font-normal">—</span>}</td>
                          <td className={`px-4 py-2.5 text-right font-semibold ${netRev < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(netRev)}</td>
                          <td className="px-4 py-2.5 text-center">
                            <Link href={`/admin/reports/trip/${t.id}`} className="rounded-lg bg-[#0c7b93] px-3 py-1 text-xs font-semibold text-white hover:bg-[#0f766e]">
                              Manifest
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom nav */}
      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={backHref} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          ← Back to Reports
        </Link>
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-[#0c7b93] px-4 py-2 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/5">
          All Reports
        </Link>
      </div>
    </div>
  );
}
