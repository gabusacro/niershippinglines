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

  // My pending bookings
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "pending");

  // My upcoming confirmed bookings
  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed")
    .order("created_at", { ascending: true })
    .limit(10);

  // Today's revenue
  const { data: todayRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("tour_operator_id", user.id)
    .eq("payment_status", "verified")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayRevenue = (todayRevData ?? []).reduce((s, b) => s + (b.total_amount_cents ?? 0), 0);

  // Total assigned bookings count
  const { count: totalBookings } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("tour_operator_id", user.id)
    .eq("status", "confirmed");

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.full_name ?? user.email ?? "Operator";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">

      {/* ── HERO BANNER ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 text-white shadow-lg mb-6">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 40 Q30 20 60 40 Q90 60 120 40' stroke='white' fill='none' stroke-width='2'/%3E%3Cpath d='M0 50 Q30 30 60 50 Q90 70 120 50' stroke='white' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
            backgroundSize: "240px 120px",
            backgroundRepeat: "repeat",
          }}
        />
        <span className="pointer-events-none absolute -right-4 top-0 select-none text-[8rem] leading-none opacity-[0.07]">🌴</span>

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">
              Tour Operator Dashboard
            </p>
            <h1 className="mt-1 font-bold text-3xl leading-tight">
              Welcome, {displayName}! 👋
            </h1>
            <p className="mt-1 text-sm text-white/70">Manage your bookings, dispatch guides, and track revenue.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{totalBookings ?? 0}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Bookings</div>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm">
              <div className="text-2xl font-bold leading-none">{myGuides.length}</div>
              <div className="mt-1 text-xs text-white/65 tracking-wide">Guides</div>
            </div>
          </div>
        </div>

        {/* Today's revenue strip */}
        <div className="relative mt-4 border-t border-white/15 pt-4 flex items-center justify-between">
          <p className="text-xs font-semibold text-white/70">Today&apos;s Revenue</p>
          <p className="text-xl font-bold text-white">₱{(todayRevenue / 100).toLocaleString()}</p>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 mb-5">
        {[
          { href: "/dashboard/tour-operator/bookings", label: "📋 My Bookings",    color: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50" },
          { href: "/dashboard/tour-operator/walk-in",  label: "✏️ Walk-in Booking", color: "border-teal-200 hover:border-teal-400 hover:bg-teal-50" },
          { href: "/dashboard/account",                label: "👤 My Account",      color: "border-gray-200 hover:border-gray-400 hover:bg-gray-50" },
        ].map(({ href, label, color }) => (
          <Link key={href} href={href}
            className={`flex min-h-[48px] items-center justify-center rounded-xl border-2 bg-white px-4 py-3 text-sm font-semibold text-[#134e4a] text-center transition-colors ${color}`}>
            {label}
          </Link>
        ))}
      </div>

      {/* ── PENDING ALERT ── */}
      {(pendingCount ?? 0) > 0 && (
        <div className="mb-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 flex items-center justify-between">
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

      {/* ── UPCOMING BOOKINGS ── */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">Upcoming Bookings</h2>
          <Link href="/dashboard/tour-operator/bookings" className="text-xs text-emerald-600 hover:underline">View all</Link>
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
                  <p className="text-sm font-bold text-emerald-700">₱{(b.total_amount_cents / 100).toLocaleString()}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MY TOUR GUIDES ── */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
        <h2 className="font-bold text-[#134e4a] mb-4">My Tour Guides</h2>
        {myGuides.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No guides assigned yet. Contact admin to add guides.</p>
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