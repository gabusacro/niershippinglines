import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tour Operator Dashboard",
};

export default async function TourOperatorDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const supabase = await createClient();

  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // Today's confirmed bookings
  const { data: todayBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("status", "confirmed")
    .eq("tour_snapshot_date", todayPH)
    .order("created_at", { ascending: false });

  // Pending payment bookings
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  // Upcoming bookings (next 7 days)
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("status", "confirmed")
    .gt("tour_snapshot_date", todayPH)
    .lte("tour_snapshot_date", in7DaysStr)
    .order("tour_snapshot_date", { ascending: true })
    .limit(10);

  // My tour guides
  const { data: myGuides } = await supabase
    .from("tour_guide_assignments")
    .select("*, guide:profiles!tour_guide_id(id, full_name, email, mobile)")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  // Today's revenue
  const { data: todayRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("status", "confirmed")
    .eq("payment_status", "verified")
    .eq("tour_snapshot_date", todayPH);

  const todayRevenue = (todayRevData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  function formatTime(time: string) {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    return (hour % 12 || 12) + ":" + m + (hour < 12 ? " AM" : " PM");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Tour Operator</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Welcome, {user.fullName?.split(" ")[0] ?? "Operator"}!
        </h1>
        <p className="mt-2 text-sm text-white/90">
          {new Date().toLocaleDateString("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "Asia/Manila" })}
        </p>
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {todayBookings?.length ?? 0} tours today
          </span>
          <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
            {myGuides?.length ?? 0} guides
          </span>
          {todayRevenue > 0 && (
            <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
              P{(todayRevenue / 100).toLocaleString()} today
            </span>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/admin/tours/bookings",       label: "All Bookings"    },
          { href: "/admin/tours/manual-booking", label: "Walk-in Booking" },
          { href: "/dashboard/tour-operator/dispatch", label: "Dispatch Guides" },
          { href: "/dashboard/account",          label: "My Account"      },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
            {label}
          </Link>
        ))}
      </div>

      {/* Pending payments alert */}
      {(pendingCount ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-amber-800">{pendingCount} booking{(pendingCount ?? 0) > 1 ? "s" : ""} awaiting payment verification</p>
            <p className="text-sm text-amber-700 mt-0.5">Review and confirm GCash screenshots.</p>
          </div>
          <Link href="/admin/tours/bookings?status=pending"
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
            Review
          </Link>
        </div>
      )}

      {/* Today's tours */}
      <div className="mt-6 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <h2 className="font-bold text-[#134e4a] mb-4">
          Today&apos;s Tours
          <span className="ml-2 text-sm font-normal text-gray-400">{formatDate(todayPH)}</span>
        </h2>

        {!todayBookings || todayBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No tours scheduled for today.</p>
        ) : (
          <div className="space-y-3">
            {todayBookings.map((b) => (
              <Link key={b.id} href={"/admin/tours/bookings/" + b.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                <div>
                  <p className="font-semibold text-sm text-[#134e4a]">
                    {(b.tour as { title?: string } | null)?.title ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.customer_name}
                    {" · "}
                    {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                    {(b.schedule as { departure_time?: string } | null)?.departure_time
                      ? " · " + formatTime((b.schedule as { departure_time: string }).departure_time)
                      : ""}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-700">
                    P{(b.total_amount_cents / 100).toLocaleString()}
                  </p>
                  {b.is_walk_in && (
                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                      Walk-in
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming bookings */}
      {upcomingBookings && upcomingBookings.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Upcoming (Next 7 Days)</h2>
          <div className="space-y-3">
            {upcomingBookings.map((b) => (
              <Link key={b.id} href={"/admin/tours/bookings/" + b.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 transition-all">
                <div>
                  <p className="font-semibold text-sm text-[#134e4a]">
                    {(b.tour as { title?: string } | null)?.title ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.tour_snapshot_date ? formatDate(b.tour_snapshot_date) : "—"}
                    {" · "}
                    {b.customer_name}
                    {" · "}
                    {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-700">
                  P{(b.total_amount_cents / 100).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* My tour guides */}
      <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">My Tour Guides</h2>
          <Link href="/admin/tours/team"
            className="text-xs text-emerald-600 hover:underline">
            Manage
          </Link>
        </div>

        {!myGuides || myGuides.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No guides assigned yet. Contact admin to add guides.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myGuides.map((a) => {
              const guide = a.guide as { id: string; full_name: string | null; email: string | null; mobile: string | null } | null;
              return (
                <div key={a.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="font-semibold text-sm text-[#134e4a]">{guide?.full_name ?? "—"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{guide?.email}</p>
                  {guide?.mobile && <p className="text-xs text-gray-400">{guide.mobile}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
