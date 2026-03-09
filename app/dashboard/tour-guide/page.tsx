import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import TourGuideScanner from "./TourGuideScanner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tour Guide Dashboard",
};

export default async function TourGuideDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_guide") redirect("/dashboard");

  const supabase = await createClient();

  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // My operator
  const { data: myAssignment } = await supabase
    .from("tour_guide_assignments")
    .select("*, operator:tour_operator_id(full_name, email, mobile)")
    .eq("tour_guide_id", user.id)
    .eq("is_active", true)
    .single();

  // Today's assigned schedules
  const { data: mySchedules } = await supabase
    .from("tour_schedule_assignments")
    .select("*, schedule:tour_schedules(id, available_date, departure_time, tour:tour_packages(title))")
    .eq("tour_guide_id", user.id)
    .eq("schedule.available_date", todayPH);

  // Today's bookings for my assigned schedules
  const scheduleIds = (mySchedules ?? [])
    .map((s) => (s.schedule as { id?: string } | null)?.id)
    .filter(Boolean) as string[];

  const { data: todayBookings } = scheduleIds.length > 0
    ? await supabase
        .from("tour_bookings")
        .select("*, tour:tour_packages(title), passengers:tour_booking_passengers(*)")
        .eq("status", "confirmed")
        .in("schedule_id", scheduleIds)
    : { data: [] };

  // Tracking status for today's passengers
  const bookingIds = (todayBookings ?? []).map((b) => b.id);
  const { data: tracking } = bookingIds.length > 0
    ? await supabase
        .from("tour_passenger_tracking")
        .select("*")
        .in("booking_id", bookingIds)
        .eq("tour_guide_id", user.id)
    : { data: [] };

  const totalGuests = (todayBookings ?? []).reduce((sum, b) => sum + (b.total_pax ?? 0), 0);
  const pickedUp = (tracking ?? []).filter((t) => t.status !== "assigned").length;

  const operator = myAssignment?.operator as { full_name: string | null; email: string | null; mobile: string | null } | null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Tour Guide</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome, {user.fullName?.split(" ")[0] ?? "Guide"}!
        </h1>
        <p className="mt-2 text-sm text-white/90">
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {totalGuests} guest{totalGuests !== 1 ? "s" : ""} today
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {pickedUp} picked up
          </span>
        </div>
      </div>

      {/* Operator info */}
      {operator ? (
        <div className="mt-5 rounded-2xl border-2 border-emerald-100 bg-emerald-50 px-5 py-4">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">My Operator</p>
          <p className="font-bold text-emerald-900">{operator.full_name ?? "—"}</p>
          <div className="flex flex-wrap gap-3 mt-1 text-xs text-emerald-700">
            {operator.email && <span>{operator.email}</span>}
            {operator.mobile && <span>{operator.mobile}</span>}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border-2 border-amber-100 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-700 font-semibold">Not linked to an operator yet.</p>
          <p className="text-xs text-amber-600 mt-0.5">Contact admin to get linked to your tour operator.</p>
        </div>
      )}

      {/* Scanner */}
      <div className="mt-5">
        <TourGuideScanner guideId={user.id} todayPH={todayPH} />
      </div>

      {/* Today's bookings */}
      <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <h2 className="font-bold text-[#134e4a] mb-4">
          Today&apos;s Guests
          <span className="ml-2 text-sm font-normal text-gray-400">{totalGuests} total</span>
        </h2>

        {!todayBookings || todayBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">
            No bookings assigned to you today.
          </p>
        ) : (
          <div className="space-y-3">
            {todayBookings.map((b) => {
              const passengers = b.passengers as Array<{ id: string; full_name: string; passenger_number: number }> ?? [];
              return (
                <div key={b.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm text-[#134e4a]">
                        {(b.tour as { title?: string } | null)?.title ?? "—"}
                      </p>
                      <p className="font-mono text-xs text-emerald-600">{b.reference}</p>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                      {b.total_pax} pax
                    </span>
                  </div>
                  <div className="space-y-1">
                    {passengers.map((p) => {
                      const tracked = (tracking ?? []).find(
                        (t) => t.booking_id === b.id && t.passenger_id === p.id
                      );
                      return (
                        <div key={p.id} className="flex items-center justify-between text-xs">
                          <span className="text-gray-700">{p.passenger_number}. {p.full_name}</span>
                          <span className={
                            "px-2 py-0.5 rounded-full font-semibold " +
                            (!tracked || tracked.status === "assigned" ? "bg-gray-100 text-gray-500" :
                             tracked.status === "picked_up" ? "bg-blue-100 text-blue-700" :
                             tracked.status === "on_tour" ? "bg-emerald-100 text-emerald-700" :
                             tracked.status === "dropped_off" ? "bg-teal-100 text-teal-700" :
                             "bg-red-100 text-red-600")
                          }>
                            {!tracked || tracked.status === "assigned" ? "Waiting" :
                             tracked.status === "picked_up" ? "Picked Up" :
                             tracked.status === "on_tour" ? "On Tour" :
                             tracked.status === "dropped_off" ? "Dropped Off" : "No Show"}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <Link href="/dashboard/account" className="text-sm text-gray-400 hover:text-emerald-600">
          My Account
        </Link>
      </div>

    </div>
  );
}