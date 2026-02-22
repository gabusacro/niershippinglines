import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Profit Distribution",
  description: "Monthly platform revenue pool breakdown — Admin",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAYMENT_STATUSES = ["confirmed", "checked_in", "boarded", "completed"];

function peso(cents: number) {
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return cents < 0 ? `-₱${formatted}` : `₱${formatted}`;
}

function pct(value: number) {
  return `${Number(value).toFixed(2)}%`;
}

export default async function AdminProfitDistributionPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const now = new Date();
  const currentYear = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);

  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // All trips this month
  const { data: allTrips } = await supabase
    .from("trips")
    .select("id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);
  const allTripIds = (allTrips ?? []).map((t) => t.id);

  // Platform fees
  let totalAdminFeeCents = 0, totalGcashFeeCents = 0, totalPassengers = 0, totalTrips = allTripIds.length;
  if (allTripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("admin_fee_cents, gcash_fee_cents, passenger_count")
      .in("trip_id", allTripIds)
      .in("status", PAYMENT_STATUSES);
    for (const b of bookings ?? []) {
      totalAdminFeeCents += b.admin_fee_cents ?? 0;
      totalGcashFeeCents += b.gcash_fee_cents ?? 0;
      totalPassengers += b.passenger_count ?? 0;
    }
  }

  const grossPlatformRevenue = totalAdminFeeCents + totalGcashFeeCents;
  const monthlyExpenses = await getMonthlyExpenses(supabase, currentYear, currentMonth);
  const netPlatformRevenue = grossPlatformRevenue - monthlyExpenses.totalCents;
  const positiveNet = Math.max(0, netPlatformRevenue);

  // Investor shares
  const { data: investorShares } = await supabase
    .from("investor_shares")
    .select("id, investor_id, share_percent, notes, investor:profiles(full_name)")
    .order("share_percent", { ascending: false });

  // Vessel owner patronage bonuses
  const { data: vesselAssignments } = await supabase
    .from("vessel_assignments")
    .select("id, vessel_owner_id, boat_id, patronage_bonus_percent, boat:boats(name), owner:profiles(full_name)")
    .order("patronage_bonus_percent", { ascending: false });

  // Calculate distributions
  type DistributionRow = {
    label: string;
    sublabel?: string;
    percent: number;
    cents: number;
    type: "investor" | "vessel_owner" | "admin";
  };

  const rows: DistributionRow[] = [];
  let totalAllocatedPercent = 0;

  for (const s of investorShares ?? []) {
    const pctVal = Number(s.share_percent ?? 0);
    const cents = Math.round(positiveNet * (pctVal / 100));
    const investor = (s as { investor?: { full_name?: string } | null }).investor;
    rows.push({
      label: investor?.full_name ?? "Unnamed Investor",
      sublabel: s.notes ?? undefined,
      percent: pctVal,
      cents,
      type: "investor",
    });
    totalAllocatedPercent += pctVal;
  }

  for (const a of vesselAssignments ?? []) {
    const pctVal = Number(a.patronage_bonus_percent ?? 0);
    const cents = Math.round(positiveNet * (pctVal / 100));
    const boat = (a as { boat?: { name?: string } | null }).boat;
    const owner = (a as { owner?: { full_name?: string } | null }).owner;
    rows.push({
      label: owner?.full_name ?? "Unnamed Owner",
      sublabel: `Vessel: ${boat?.name ?? "—"}`,
      percent: pctVal,
      cents,
      type: "vessel_owner",
    });
    totalAllocatedPercent += pctVal;
  }

  const adminPercent = Math.max(0, 100 - totalAllocatedPercent);
  const adminCents = Math.round(positiveNet * (adminPercent / 100));
  rows.push({
    label: "Admin (You)",
    sublabel: "Remainder after all shares",
    percent: adminPercent,
    cents: adminCents,
    type: "admin",
  });

  const totalDistributed = rows.reduce((s, r) => s + r.cents, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">Profit Distribution</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            {MONTH_NAMES[currentMonth - 1]} {currentYear} — Complete platform revenue breakdown
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/investor-shares" className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">
            Manage Investors
          </Link>
          <Link href="/admin/vessel-owners" className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">
            Manage Vessel Owners
          </Link>
          <Link href="/admin/expenses" className="rounded-lg border border-teal-200 px-3 py-1.5 text-xs font-semibold text-[#0c7b93] hover:bg-teal-50">
            Manage Expenses
          </Link>
        </div>
      </div>

      {/* Platform Revenue Waterfall */}
      <div className="mt-6 rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-[#134e4a]">Platform Revenue — {MONTH_NAMES[currentMonth - 1]} {currentYear}</p>

        <div className="mt-4 space-y-2">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Trips</p>
              <p className="text-lg font-bold text-[#134e4a]">{totalTrips}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Passengers</p>
              <p className="text-lg font-bold text-[#134e4a]">{totalPassengers.toLocaleString()}</p>
            </div>
            <div className="rounded-lg bg-teal-50 p-3">
              <p className="text-xs text-[#0f766e]">Avg pax/trip</p>
              <p className="text-lg font-bold text-[#134e4a]">{totalTrips > 0 ? (totalPassengers / totalTrips).toFixed(1) : "—"}</p>
            </div>
          </div>

          {/* Revenue waterfall */}
          <div className="mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between border-b border-teal-100 pb-2">
              <span className="text-[#134e4a] font-medium">Admin Fees ({totalPassengers} pax × ₱20)</span>
              <span className="font-semibold text-emerald-700">{peso(totalAdminFeeCents)}</span>
            </div>
            <div className="flex justify-between border-b border-teal-100 pb-2">
              <span className="text-[#134e4a] font-medium">GCash Fees ({totalPassengers} pax × ₱15)</span>
              <span className="font-semibold text-blue-700">{peso(totalGcashFeeCents)}</span>
            </div>
            <div className="flex justify-between border-b-2 border-teal-200 pb-2 font-semibold">
              <span className="text-[#134e4a]">Gross Platform Revenue</span>
              <span className="text-[#134e4a]">{peso(grossPlatformRevenue)}</span>
            </div>

            {/* Expenses */}
            {monthlyExpenses.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-rose-600 pl-2">
                <span>− {item.name}{item.is_recurring ? "" : " (one-time)"}</span>
                <span>{peso(-item.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-b-2 border-teal-200 pb-2 font-semibold">
              <span className="text-rose-600">Total Expenses</span>
              <span className="text-rose-600">{peso(-monthlyExpenses.totalCents)}</span>
            </div>

            <div className="flex justify-between pt-1">
              <span className="font-bold text-base text-[#134e4a]">Net Platform Revenue</span>
              <span className={`font-bold text-xl ${netPlatformRevenue < 0 ? "text-red-600" : "text-emerald-700"}`}>
                {peso(netPlatformRevenue)}
              </span>
            </div>
            {netPlatformRevenue < 0 && (
              <p className="text-xs text-red-500">⚠ Negative pool — all shares are ₱0 this month. Expenses exceed fees collected.</p>
            )}
          </div>
        </div>
      </div>

      {/* Distribution Table */}
      <div className="mt-6">
        <p className="text-sm font-semibold text-[#134e4a]">Distribution of {peso(positiveNet)} pool</p>
        {totalAllocatedPercent > 100 && (
          <p className="mt-1 text-xs text-red-600">⚠ Total allocated shares exceed 100%! Please adjust in investor or vessel owner settings.</p>
        )}

        <div className="mt-3 overflow-x-auto rounded-xl border border-teal-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-teal-100 text-sm">
            <thead>
              <tr className="bg-[#0c7b93]/10">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Recipient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-[#134e4a]">Role</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Share %</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-[#134e4a]">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-100">
              {rows.map((row, i) => (
                <tr key={i} className={`hover:bg-teal-50/40 ${row.type === "admin" ? "bg-teal-50/60 font-semibold" : ""}`}>
                  <td className="px-4 py-3">
                    <p className={`font-medium ${row.type === "investor" ? "text-amber-800" : row.type === "vessel_owner" ? "text-[#0c7b93]" : "text-[#134e4a]"}`}>
                      {row.type === "investor" ? "💼 " : row.type === "vessel_owner" ? "🚢 " : "👤 "}{row.label}
                    </p>
                    {row.sublabel && <p className="text-xs text-[#0f766e]/70">{row.sublabel}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.type === "investor" ? "bg-amber-100 text-amber-700" :
                      row.type === "vessel_owner" ? "bg-teal-100 text-teal-700" :
                      "bg-emerald-100 text-emerald-700"
                    }`}>
                      {row.type === "investor" ? "Investor" : row.type === "vessel_owner" ? "Vessel Owner" : "Admin"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-[#134e4a]">{pct(row.percent)}</td>
                  <td className={`px-4 py-3 text-right font-bold text-lg ${
                    row.cents <= 0 ? "text-gray-400" :
                    row.type === "investor" ? "text-amber-700" :
                    row.type === "vessel_owner" ? "text-[#0c7b93]" :
                    "text-emerald-700"
                  }`}>
                    {peso(row.cents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#134e4a]/5 font-semibold">
                <td className="px-4 py-3 text-[#134e4a]">Total</td>
                <td />
                <td className="px-4 py-3 text-right text-[#134e4a]">{pct(totalAllocatedPercent > 100 ? totalAllocatedPercent : 100)}</td>
                <td className="px-4 py-3 text-right text-[#134e4a]">{peso(totalDistributed)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Quick links */}
      <div className="mt-8 rounded-xl border border-teal-100 bg-teal-50 p-4">
        <p className="text-xs font-semibold uppercase text-[#0c7b93]">Adjust the numbers</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link href="/admin/expenses" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            ✏️ Edit Expenses
          </Link>
          <Link href="/admin/investor-shares" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            ✏️ Edit Investor Shares
          </Link>
          <Link href="/admin/vessel-owners" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            ✏️ Edit Vessel Owner Bonuses
          </Link>
          <Link href="/admin/fees" className="rounded-xl border-2 border-teal-200 bg-white px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
            ✏️ Edit Fee Settings
          </Link>
        </div>
      </div>
    </div>
  );
}
