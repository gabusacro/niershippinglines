import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Tour Operator Dashboard" };

export default async function TourOperatorDashboard() {
  const user = await getAuthUser();
  if (!user || user.role !== "tour_operator") redirect("/dashboard");

  const supabase = await createClient();
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // My assigned guides
  const { data: rawGuides } = await supabase
    .from("tour_guide_assignments")
    .select("id, tour_guide_id, assigned_at")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  const guideIds = (rawGuides ?? []).map((g) => g.tour_guide_id);
  const { data: guideProfiles } = guideIds.length > 0
    ? await supabase.from("profiles").select("id, full_name, email, mobile").in("id", guideIds)
    : { data: [] };

  const myGuides = (rawGuides ?? []).map((g) => ({
    ...g,
    guide: (guideProfiles ?? []).find((p) => p.id === g.tour_guide_id) ?? null,
  }));

  // My pending bookings (assigned to me, payment not yet verified)
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "pending");

  // My upcoming bookings (assigned to me, confirmed)
  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(10);

  // Today's revenue (my bookings only)
  const { data: todayRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "verified")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayRevenue = (todayRevData ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);

  // Operator's own profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#134e4a]">🧑‍💼 Tour Operator</h1>
        <p className="text-sm text-gray-500 mt-1">{profile?.full_name ?? user.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
          <p className="text-xs text-gray-400 mb-1">My Guides</p>
          <p className="text-3xl font-bold text-[#134e4a]">{myGuides.length}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
          <p className="text-xs text-gray-400 mb-1">Today's Revenue</p>
          <p className="text-2xl font-bold text-emerald-600">
            ₱{(todayRevenue / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 mb-2">
        {[
          { href: "/dashboard/tour-operator/bookings", label: "📋 My Bookings" },
          { href: "/dashboard/tour-operator/walk-in",  label: "✏️ Walk-in Booking" },
          { href: "/dashboard/account",                label: "👤 My Account" },
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
            <p className="text-sm text-amber-700 mt-0.5">These bookings are pending admin confirmation.</p>
          </div>
          <Link href="/dashboard/tour-operator/bookings?status=pending"
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
            View
          </Link>
        </div>
      )}

      {/* Upcoming Bookings */}
      <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">Upcoming Bookings</h2>
          <Link href="/dashboard/tour-operator/bookings" className="text-xs text-emerald-600 hover:underline">
            View all
          </Link>
        </div>
        {!upcomingBookings || upcomingBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No bookings assigned yet.</p>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map((b) => {
              const schedDate = (b.schedule as { available_date?: string } | null)?.available_date;
              return (
                <Link key={b.id} href={"/dashboard/tour-operator/bookings/" + b.id}
                  className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 transition-all">
                  <div>
                    <p className="font-semibold text-sm text-[#134e4a]">
                      {(b.tour as { title?: string } | null)?.title ?? "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                      {schedDate ? " · " + new Date(schedDate + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" }) : ""}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-emerald-700">
                    ₱{(b.total_amount_cents / 100).toLocaleString()}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* My Tour Guides */}
      <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">My Tour Guides</h2>
        </div>
        {myGuides.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No guides assigned yet. Contact admin to add guides.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myGuides.map((a) => (
              <div key={a.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                <p className="font-semibold text-sm text-[#134e4a]">{a.guide?.full_name ?? "—"}</p>
                <p className="text-xs text-gray-400 mt-0.5">{a.guide?.email ?? "—"}</p>
                {a.guide?.mobile && <p className="text-xs text-gray-400">{a.guide.mobile}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}