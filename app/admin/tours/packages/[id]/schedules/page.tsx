import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tour Schedules — Admin" };

function formatDate(dateStr: string) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });
}

export default async function TourSchedulesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const sp = await searchParams;
  const added = typeof sp.added === "string" ? sp.added : null;
  const flashError = typeof sp.error === "string" ? sp.error : null;
  const supabase = await createClient();

  // Load the package
  const { data: pkg, error: pkgError } = await supabase
    .from("tour_packages")
    .select("id, title, accepts_joiners, accepts_private, accepts_exclusive, exclusive_unit_label, pickup_time_label")
    .eq("id", id)
    .single();

  if (!pkg || pkgError) notFound();

  // Load existing schedules
  const { data: schedules } = await supabase
    .from("tour_schedules")
    .select("*")
    .eq("tour_id", id)
    .order("available_date", { ascending: true });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = (schedules ?? []).filter(s => s.available_date >= today);
  const past = (schedules ?? []).filter(s => s.available_date < today);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-emerald-700 mb-4">
        <Link href="/admin" className="hover:underline">Admin</Link>
        <span>/</span>
        <Link href="/admin/tours" className="hover:underline">Tours</Link>
        <span>/</span>
        <Link href="/admin/tours/packages" className="hover:underline">Packages</Link>
        <span>/</span>
        <Link href={`/admin/tours/packages/${id}`} className="hover:underline truncate max-w-[160px]">{pkg.title}</Link>
        <span>/</span>
        <span className="font-semibold">Schedules</span>
      </div>

      <h1 className="text-2xl font-bold text-[#134e4a] mb-1">📅 Schedules</h1>
      <p className="text-sm text-gray-500 mb-6">{pkg.title}</p>

      {/* Flash messages */}
      {added && (
        <div className="mb-4 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
          ✅ Schedule added for {added}.
        </div>
      )}
      {flashError && (
        <div className="mb-4 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          ❌ {flashError}
        </div>
      )}

      {/* ── ADD NEW SCHEDULE FORM ── */}
      <div className="rounded-2xl border-2 border-emerald-200 bg-white p-6 mb-8">
        <h2 className="font-bold text-[#134e4a] mb-4">+ Add New Date</h2>
        <form action={`/api/admin/tours/schedules/create`} method="POST">
          <input type="hidden" name="tour_id" value={id} />

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input type="date" name="available_date" required min={today}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departure Time <span className="text-red-500">*</span>
              </label>
              <input type="time" name="departure_time" required
                defaultValue={pkg.pickup_time_label?.split("–")[0]?.trim().includes("AM") || pkg.pickup_time_label?.split("–")[0]?.trim().includes("PM") ? "" : "07:45"}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            {/* Joiner slots */}
            {pkg.accepts_joiners && (
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-emerald-700 font-bold text-sm">👥 Joiner Slots</span>
                  <span className="text-xs text-gray-400">(individual seats)</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Total seats available</label>
                  <input type="number" name="joiner_slots_total" min="0" max="200"
                    defaultValue="20"
                    className="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none bg-white" />
                  <p className="text-xs text-gray-400 mt-1">e.g. 20 = max 20 individual pax can join</p>
                </div>
              </div>
            )}

            {/* Private slots */}
            {pkg.accepts_private && (
              <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-teal-700 font-bold text-sm">🔒 Private Slots</span>
                  <span className="text-xs text-gray-400">(whole group bookings)</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Private groups available</label>
                  <input type="number" name="private_slots_total" min="0" max="20"
                    defaultValue="1"
                    className="w-full rounded-lg border border-teal-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none bg-white" />
                  <p className="text-xs text-gray-400 mt-1">e.g. 1 = 1 private group can book this date</p>
                </div>
              </div>
            )}

            {/* Exclusive units */}
            {pkg.accepts_exclusive && (
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-blue-700 font-bold text-sm">🚐 {pkg.exclusive_unit_label ?? "Units"}</span>
                  <span className="text-xs text-gray-400">(units available)</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    How many {pkg.exclusive_unit_label ?? "units"} available?
                  </label>
                  <input type="number" name="exclusive_units_total" min="0" max="20"
                    defaultValue="1"
                    className="w-full rounded-lg border border-blue-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none bg-white" />
                </div>
              </div>
            )}
          </div>

          {/* Booking cutoff */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Booking Cutoff (hours before tour)
            </label>
            <input type="number" name="cutoff_hours" min="1" max="168"
              defaultValue="24"
              className="w-32 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            <span className="ml-2 text-xs text-gray-400">Default: 24 hours</span>
          </div>

          {/* Notes */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input type="text" name="notes"
              placeholder="e.g. Holiday schedule, limited slots"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
          </div>

          <button type="submit"
            className="rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors">
            Add Schedule
          </button>
        </form>
      </div>

      {/* ── UPCOMING SCHEDULES ── */}
      <div className="mb-8">
        <h2 className="font-bold text-[#134e4a] mb-3">
          Upcoming Schedules
          <span className="ml-2 text-sm font-normal text-gray-400">({upcoming.length})</span>
        </h2>

        {upcoming.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-emerald-100 p-8 text-center text-sm text-gray-400">
            No upcoming schedules yet. Add a date above to open bookings.
          </div>
        ) : (
          <div className="space-y-3">
            {upcoming.map(s => (
              <div key={s.id}
                className="rounded-2xl border-2 border-emerald-100 bg-white p-4 flex flex-wrap items-center gap-4">

                {/* Date & time */}
                <div className="min-w-[160px]">
                  <div className="font-bold text-[#134e4a]">{formatDate(s.available_date)}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Departure: {s.departure_time?.slice(0, 5)}
                  </div>
                </div>

                {/* Status badge */}
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  s.status === "open"      ? "bg-emerald-100 text-emerald-700" :
                  s.status === "full"      ? "bg-red-100 text-red-700" :
                  s.status === "cancelled" ? "bg-gray-100 text-gray-500" :
                  "bg-amber-100 text-amber-700"
                }`}>
                  {s.status.toUpperCase()}
                </span>

                {/* Slot counters */}
                <div className="flex gap-4 flex-1 flex-wrap">
                  {s.accepts_joiners && (
                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-center min-w-[90px]">
                      <div className="text-xs font-medium text-emerald-600 mb-0.5">👥 Joiners</div>
                      <div className="text-lg font-bold text-emerald-800">
                        {s.joiner_slots_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.joiner_slots_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.joiner_slots_total - s.joiner_slots_booked} left</div>
                    </div>
                  )}
                  {s.accepts_private && (
                    <div className="rounded-lg bg-teal-50 border border-teal-100 px-3 py-2 text-center min-w-[90px]">
                      <div className="text-xs font-medium text-teal-600 mb-0.5">🔒 Private</div>
                      <div className="text-lg font-bold text-teal-800">
                        {s.private_slots_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.private_slots_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.private_slots_total - s.private_slots_booked} left</div>
                    </div>
                  )}
                  {s.accepts_exclusive && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 px-3 py-2 text-center min-w-[90px]">
                      <div className="text-xs font-medium text-blue-600 mb-0.5">🚐 Units</div>
                      <div className="text-lg font-bold text-blue-800">
                        {s.exclusive_units_booked}
                        <span className="text-sm font-normal text-gray-400">/{s.exclusive_units_total}</span>
                      </div>
                      <div className="text-xs text-gray-400">{s.exclusive_units_total - s.exclusive_units_booked} left</div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {s.notes && (
                  <div className="text-xs text-gray-400 italic">{s.notes}</div>
                )}

                {/* Cancel button */}
                {s.status === "open" && (
                  <form action="/api/admin/tours/schedules/cancel" method="POST">
                    <input type="hidden" name="schedule_id" value={s.id} />
                    <input type="hidden" name="tour_id" value={id} />
                    <button type="submit"
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── PAST SCHEDULES ── */}
      {past.length > 0 && (
        <div>
          <h2 className="font-bold text-gray-400 mb-3 text-sm uppercase tracking-wider">
            Past Schedules ({past.length})
          </h2>
          <div className="space-y-2">
            {past.slice(0, 5).map(s => (
              <div key={s.id}
                className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 flex flex-wrap items-center gap-4 opacity-60">
                <div className="font-medium text-gray-600 text-sm">{formatDate(s.available_date)}</div>
                {s.accepts_joiners && (
                  <span className="text-xs text-gray-400">👥 {s.joiner_slots_booked}/{s.joiner_slots_total} joiners</span>
                )}
                {s.accepts_private && (
                  <span className="text-xs text-gray-400">🔒 {s.private_slots_booked}/{s.private_slots_total} private</span>
                )}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${
                  s.status === "cancelled" ? "bg-gray-100 text-gray-400" : "bg-gray-100 text-gray-500"
                }`}>{s.status}</span>
              </div>
            ))}
            {past.length > 5 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{past.length - 5} older schedules hidden</p>
            )}
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mt-8">
        <Link href={`/admin/tours/packages/${id}`}
          className="text-sm font-medium text-emerald-700 hover:underline">
          ← Back to {pkg.title}
        </Link>
      </div>

    </div>
  );
}