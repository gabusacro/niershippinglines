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

  const { data: rawGuides } = await supabase
    .from("tour_guide_assignments")
    .select("id, tour_guide_id, assigned_at")
    .eq("tour_operator_id", user.id)
    .eq("is_active", true);

  const guideIds = (rawGuides ?? []).map((g) => g.tour_guide_id);

  const { data: guideProfiles } = guideIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email, mobile")
        .in("id", guideIds)
    : { data: [] };

  const myGuides = (rawGuides ?? []).map((g) => ({
    ...g,
    guide: (guideProfiles ?? []).find((p) => p.id === g.tour_guide_id) ?? null,
  }));

  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("status", "confirmed")
    .gte("created_at", todayPH)
    .lte("created_at", in7DaysStr)
    .order("created_at", { ascending: true })
    .limit(10);

  const { data: todayRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayRevenue = (todayRevData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      weekday: "short", month: "short", day: "numeric",
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

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
            {myGuides.length} guide{myGuides.length !== 1 ? "s" : ""}
          </span>
          {todayRevenue > 0 && (
            <span className="bg-white/20 px-3 py-1 rounded-full font-semibold">
              ₱{(todayRevenue / 100).toLocaleString()} today
            </span>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "/admin/tours/bookings",       label: "All Bookings"    },
          { href: "/admin/tours/manual-booking", label: "Walk-in Booking" },
          { href: "/admin/tours/team",           label: "Manage Team"     },
          { href: "/dashboard/account",          label: "My Account"      },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
            {label}
          </Link>
        ))}
      </div>

      {(pendingCount ?? 0) > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-amber-200 bg-amber-50 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold text-amber-800">{pendingCount} booking{(pendingCount ?? 0) > 1 ? "s" : ""} awaiting payment</p>
            <p className="text-sm text-amber-700 mt-0.5">Review and confirm GCash screenshots.</p>
          </div>
          <Link href="/admin/tours/bookings?status=pending"
            className="px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors">
            Review
          </Link>
        </div>
      )}

      {upcomingBookings && upcomingBookings.length > 0 && (
        <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
          <h2 className="font-bold text-[#134e4a] mb-4">Upcoming Bookings</h2>
          <div className="space-y-3">
            {upcomingBookings.map((b) => (
              <Link key={b.id} href={"/admin/tours/bookings/" + b.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 transition-all">
                <div>
                  <p className="font-semibold text-sm text-[#134e4a]">
                    {(b.tour as { title?: string } | null)?.title ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {b.customer_name} · {b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm font-bold text-emerald-700">
                  ₱{(b.total_amount_cents / 100).toLocaleString()}
                </p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">My Tour Guides</h2>
          <Link href="/admin/tours/team" className="text-xs text-emerald-600 hover:underline">
            Manage
          </Link>
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

