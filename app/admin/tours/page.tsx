import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Tours — Admin",
  description: "Manage tour packages, schedules, and bookings",
};

export default async function AdminToursPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const todayPH = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  // Total bookings count — exclude operator walk-ins
  const { count: totalBookings } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .neq("booking_source", "operator_walk_in");

  // Pending payment bookings — exclude operator walk-ins
  const { count: pendingCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
    .neq("booking_source", "operator_walk_in");

  // Confirmed bookings — exclude operator walk-ins
  const { count: confirmedCount } = await supabase
    .from("tour_bookings")
    .select("*", { count: "exact", head: true })
    .eq("status", "confirmed")
    .neq("booking_source", "operator_walk_in");

  // Online revenue (all time) — online bookings only (money YOU received)
  const { data: onlineRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .eq("booking_source", "online");

  const onlineRevenue = (onlineRevData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  // Walk-in revenue (all time) — YOUR walk-ins only (money YOU collected)
  const { data: walkinRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .eq("booking_source", "walk_in");

  const walkinRevenue = (walkinRevData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  // Operator walk-in revenue (all time) — money the OPERATOR collected, NOT yours
  const { data: opWalkinRevData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .eq("booking_source", "operator_walk_in");

  const opWalkinRevenue = (opWalkinRevData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  // Today's online revenue
  const { data: todayOnlineData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .eq("booking_source", "online")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayOnlineRevenue = (todayOnlineData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  // Today's walk-in revenue (YOUR walk-ins)
  const { data: todayWalkinData } = await supabase
    .from("tour_bookings")
    .select("total_amount_cents")
    .eq("payment_status", "verified")
    .eq("booking_source", "walk_in")
    .gte("payment_verified_at", todayPH + "T00:00:00+08:00")
    .lte("payment_verified_at", todayPH + "T23:59:59+08:00");

  const todayWalkinRevenue = (todayWalkinData ?? []).reduce(
    (sum, b) => sum + (b.total_amount_cents ?? 0), 0
  );

  // Upcoming tours (next 7 days) — using schedule join, exclude operator walk-ins
  const in7Days = new Date();
  in7Days.setDate(in7Days.getDate() + 7);
  const in7DaysStr = in7Days.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  const { data: upcomingBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title), schedule:tour_schedules(available_date, departure_time)")
    .eq("status", "confirmed")
    .neq("booking_source", "operator_walk_in")
    .order("created_at", { ascending: true })
    .limit(5);

  // Filter upcoming by schedule date on client side (since we can't filter on joined column easily)
  const filteredUpcoming = (upcomingBookings ?? []).filter((b) => {
    const d = (b.schedule as { available_date?: string } | null)?.available_date;
    return d && d >= todayPH && d <= in7DaysStr;
  });

  // Recent bookings — exclude operator walk-ins
  const { data: recentBookings } = await supabase
    .from("tour_bookings")
    .select("*, tour:tour_packages(title)")
    .neq("booking_source", "operator_walk_in")
    .order("created_at", { ascending: false })
    .limit(5);

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-PH", {
      month: "short", day: "numeric", year: "numeric",
    });
  }

  const statusColor: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-700",
    confirmed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-gray-100 text-gray-500",
    completed: "bg-blue-100 text-blue-700",
  };

  const totalYourRevenue = onlineRevenue + walkinRevenue;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-600 px-6 py-8 text-white shadow-lg sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wider text-white/80">Admin — Tours</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Tour Management</h1>
        <p className="mt-2 max-w-xl text-sm text-white/90">
          Manage packages, schedules, bookings, and reviews for all Kuya Gab tour services.
        </p>
      </div>

      {/* Nav grid */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {[
          { href: "/admin/tours/packages",      label: "Packages"        },
          { href: "/admin/tours/bookings",       label: "Bookings"        },
          { href: "/admin/tours/manual-booking", label: "Walk-in Booking" },
          { href: "/admin/tours/reviews",        label: "Reviews"         },
          { href: "/admin/tours/refunds",        label: "Refunds"         },
          { href: "/admin/tours/expenses",       label: "Expenses"        },
          { href: "/admin/tours/categories",     label: "Categories"      },
          { href: "/admin/tours/team",           label: "Team"            },
          { href: "/admin/tours/settings",       label: "Settings"        },
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-emerald-800 text-center transition-colors hover:border-emerald-400 hover:bg-emerald-50">
            {label}
          </Link>
        ))}
        <Link href="/admin"
          className="flex min-h-[48px] items-center justify-center rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50">
          Back to Admin
        </Link>
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Bookings</p>
          <p className="text-3xl font-bold text-emerald-700">{totalBookings ?? 0}</p>
          <p className="text-xs text-gray-400 mt-1">Excl. operator walk-ins</p>
        </div>
        <div className="rounded-2xl border-2 border-amber-100 bg-white p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Pending Payment</p>
          <p className="text-3xl font-bold text-amber-600">{pendingCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border-2 border-emerald-100 bg-white p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Confirmed</p>
          <p className="text-3xl font-bold text-emerald-700">{confirmedCount ?? 0}</p>
        </div>
        <div className="rounded-2xl border-2 border-blue-100 bg-white p-5">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Today (Online)</p>
          <p className="text-2xl font-bold text-blue-700">
            ₱{(todayOnlineRevenue / 100).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Revenue split */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {/* Online Revenue — YOU received this */}
        <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-emerald-900">Online Revenue</h2>
            <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-semibold">Online</span>
          </div>
          <p className="text-3xl font-bold text-emerald-700">₱{(onlineRevenue / 100).toLocaleString()}</p>
          <p className="text-xs text-emerald-600 mt-1">All time · GCash payments</p>
          {todayOnlineRevenue > 0 && (
            <p className="text-sm font-semibold text-emerald-700 mt-2">
              Today: ₱{(todayOnlineRevenue / 100).toLocaleString()}
            </p>
          )}
        </div>

        {/* Walk-in Revenue — YOU received this */}
        <div className="rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-blue-900">Walk-in Revenue</h2>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-semibold">Your Walk-in</span>
          </div>
          <p className="text-3xl font-bold text-blue-700">₱{(walkinRevenue / 100).toLocaleString()}</p>
          <p className="text-xs text-blue-600 mt-1">All time · Cash you collected</p>
          {todayWalkinRevenue > 0 && (
            <p className="text-sm font-semibold text-blue-700 mt-2">
              Today: ₱{(todayWalkinRevenue / 100).toLocaleString()}
            </p>
          )}
        </div>

        {/* Operator Walk-in — NOT your money */}
        <div className="rounded-2xl border-2 border-purple-200 bg-purple-50 p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-purple-900">Operator Walk-ins</h2>
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-semibold">Not Yours</span>
          </div>
          <p className="text-3xl font-bold text-purple-700">₱{(opWalkinRevenue / 100).toLocaleString()}</p>
          <p className="text-xs text-purple-600 mt-1">Cash collected by operator directly</p>
          <p className="text-xs text-purple-500 mt-1 font-semibold">⚠️ You did not receive this</p>
        </div>
      </div>

      {/* Your total revenue summary */}
      <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-700 px-6 py-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-emerald-200 uppercase tracking-wide">Your Total Revenue (All Time)</p>
          <p className="text-xs text-emerald-300 mt-0.5">Online + Your Walk-ins only</p>
        </div>
        <p className="text-3xl font-bold text-white">₱{(totalYourRevenue / 100).toLocaleString()}</p>
      </div>

      {/* Upcoming tours */}
      {filteredUpcoming.length > 0 && (
        <div className="mt-6 rounded-2xl border-2 border-emerald-100 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#134e4a]">Upcoming Tours (Next 7 Days)</h2>
            <Link href="/admin/tours/bookings?status=confirmed"
              className="text-xs text-emerald-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {filteredUpcoming.map((b) => {
              const schedDate = (b.schedule as { available_date?: string } | null)?.available_date;
              return (
                <Link key={b.id} href={"/admin/tours/bookings/" + b.id}
                  className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50/40 px-4 py-3 hover:border-emerald-300 transition-all">
                  <div>
                    <p className="font-semibold text-sm text-[#134e4a]">
                      {(b.tour as { title?: string } | null)?.title ?? "—"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {schedDate ? formatDate(schedDate) : "—"}
                      {" · "}{b.total_pax} guest{b.total_pax > 1 ? "s" : ""}
                      {" · "}{b.customer_name}
                    </p>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-bold text-emerald-700">
                      ₱{(b.total_amount_cents / 100).toLocaleString()}
                    </p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      b.booking_source === "walk_in"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-emerald-100 text-emerald-600"
                    }`}>
                      {b.booking_source === "walk_in" ? "Walk-in" : "Online"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent bookings */}
      <div className="mt-6 rounded-2xl border-2 border-gray-100 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-[#134e4a]">Recent Bookings</h2>
          <Link href="/admin/tours/bookings" className="text-xs text-emerald-600 hover:underline">View all</Link>
        </div>

        {!recentBookings || recentBookings.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No bookings yet.</p>
        ) : (
          <div className="space-y-3">
            {recentBookings.map((b) => (
              <Link key={b.id} href={"/admin/tours/bookings/" + b.id}
                className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                <div>
                  <p className="font-mono text-xs text-emerald-600 font-bold">{b.reference}</p>
                  <p className="font-semibold text-sm text-[#134e4a] mt-0.5">
                    {(b.tour as { title?: string } | null)?.title ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{b.customer_name}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (statusColor[b.status] ?? "bg-gray-100 text-gray-500")}>
                    {b.status.toUpperCase()}
                  </span>
                  <p className="text-sm font-bold text-emerald-700">
                    {b.total_amount_cents > 0
                      ? "₱" + (b.total_amount_cents / 100).toLocaleString()
                      : "Negotiable"}
                  </p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    b.booking_source === "walk_in"
                      ? "bg-blue-100 text-blue-600"
                      : b.booking_source === "operator_walk_in"
                      ? "bg-purple-100 text-purple-600"
                      : "bg-emerald-100 text-emerald-600"
                  }`}>
                    {b.booking_source === "walk_in" ? "Walk-in" :
                     b.booking_source === "operator_walk_in" ? "Op. Walk-in" : "Online"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
