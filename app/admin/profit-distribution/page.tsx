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
  const formatted = Math.abs(cents / 100).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
  const currentYear = parseInt(
    now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10
  );
  const currentMonth = parseInt(
    now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10
  );

  const monthStr = String(currentMonth).padStart(2, "0");
  const monthStart = `${currentYear}-${monthStr}-01`;
  const lastDay = new Date(currentYear, currentMonth, 0).getDate();
  const monthEnd = `${currentYear}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

  // ── All trips this month, with boat_id ──────────────────────────────────
  const { data: allTrips } = await supabase
    .from("trips")
    .select("id, boat_id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);

  const allTripIds = (allTrips ?? []).map((t) => t.id);
  const totalTrips = allTripIds.length;

  // Active vessels this month (distinct boat_ids that have trips)
  const activeBoatIds = [...new Set((allTrips ?? []).map((t) => t.boat_id).filter(Boolean))];
  const activeVesselCount = activeBoatIds.length;

  // ── Bookings: total platform fees + per-vessel breakdown ────────────────
  let totalAdminFeeCents = 0;
  let totalGcashFeeCents = 0;
  let totalPassengers = 0;

  // Per-vessel fee accumulator
  const feesByBoat = new Map<string, { adminFee: number; gcashFee: number; passengers: number }>();

  // Build trip → boat map
  const tripToBoat = new Map<string, string>();
  for (const t of allTrips ?? []) {
    if (t.boat_id) tripToBoat.set(t.id, t.boat_id);
  }

  if (allTripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, admin_fee_cents, gcash_fee_cents, passenger_count")
      .in("trip_id", allTripIds)
      .in("status", PAYMENT_STATUSES);

    for (const b of bookings ?? []) {
      const af = b.admin_fee_cents ?? 0;
      const gf = b.gcash_fee_cents ?? 0;
      const pax = b.passenger_count ?? 0;
      totalAdminFeeCents += af;
      totalGcashFeeCents += gf;
      totalPassengers += pax;

      const boatId = tripToBoat.get(b.trip_id);
      if (boatId) {
        const cur = feesByBoat.get(boatId) ?? { adminFee: 0, gcashFee: 0, passengers: 0 };
        cur.adminFee += af;
        cur.gcashFee += gf;
        cur.passengers += pax;
        feesByBoat.set(boatId, cur);
      }
    }
  }

  const grossPlatformRevenue = totalAdminFeeCents + totalGcashFeeCents;

  // ── Expenses ────────────────────────────────────────────────────────────
  const monthlyExpenses = await getMonthlyExpenses(supabase, currentYear, currentMonth);
  const totalExpensesCents = monthlyExpenses.totalCents;

  // Expenses split equally among active vessels
  const expensePerVesselCents = activeVesselCount > 0
    ? Math.round(totalExpensesCents / activeVesselCount)
    : totalExpensesCents;

  // ── Net platform revenue (for profit pool) ──────────────────────────────
  const netPlatformRevenue = grossPlatformRevenue - totalExpensesCents;
  const positiveNet = Math.max(0, netPlatformRevenue);

  // ── Vessel assignments + boat names ────────────────────────────────────
  const { data: vesselAssignments } = await supabase
    .from("vessel_assignments")
    .select("id, vessel_owner_id, boat_id, patronage_bonus_percent, boat:boats(name), owner:profiles(full_name)")
    .order("patronage_bonus_percent", { ascending: false });

  // Boats for active vessel list
  const { data: activeBoats } = activeBoatIds.length > 0
    ? await supabase.from("boats").select("id, name").in("id", activeBoatIds)
    : { data: [] };

  const boatNameById = new Map<string, string>();
  for (const b of activeBoats ?? []) boatNameById.set(b.id, b.name);

  // ── Operator Loyalty Bonuses (per vessel, from gross fees) ──────────────
  // Each vessel owner gets X% of THEIR vessel's own platform fees
  type LoyaltyRow = {
    ownerName: string;
    boatName: string;
    patronagePct: number;
    vesselGrossFeeCents: number;
    vesselExpenseCents: number;
    vesselNetCents: number;
    bonusCents: number;
  };

  const loyaltyRows: LoyaltyRow[] = [];
  let totalLoyaltyBonusCents = 0;

  for (const a of vesselAssignments ?? []) {
    const boat = (a as { boat?: { name?: string } | null }).boat;
    const owner = (a as { owner?: { full_name?: string } | null }).owner;
    const pctVal = Number(a.patronage_bonus_percent ?? 0);
    const vesselFees = feesByBoat.get(a.boat_id) ?? { adminFee: 0, gcashFee: 0, passengers: 0 };
    const vesselGrossFee = vesselFees.adminFee + vesselFees.gcashFee;
    const bonusCents = Math.round(vesselGrossFee * (pctVal / 100));
    // Each vessel bears its share of expenses
    const vesselExpense = activeBoatIds.includes(a.boat_id) ? expensePerVesselCents : 0;
    const vesselNet = vesselGrossFee - vesselExpense;

    loyaltyRows.push({
      ownerName: owner?.full_name ?? "Unnamed Owner",
      boatName: boat?.name ?? "—",
      patronagePct: pctVal,
      vesselGrossFeeCents: vesselGrossFee,
      vesselExpenseCents: vesselExpense,
      vesselNetCents: vesselNet,
      bonusCents,
    });
    totalLoyaltyBonusCents += bonusCents;
  }

  // ── Investor shares (from net pool) ────────────────────────────────────
  const { data: investorShares } = await supabase
    .from("investor_shares")
    .select("id, investor_id, share_percent, notes, investor:profiles(full_name)")
    .order("share_percent", { ascending: false });

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
      sublabel: s.notes ?? "Silent Investor",
      percent: pctVal,
      cents,
      type: "investor",
    });
    totalAllocatedPercent += pctVal;
  }

  // Vessel owners also get a share of the net pool (their % of net)
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
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-6">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">Profit Distribution</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            {MONTH_NAMES[currentMonth - 1]} {currentYear} — Complete platform revenue breakdown
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
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

      {/* ── SECTION 1: Platform Revenue Waterfall ── */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide">
          📊 Platform Revenue — {MONTH_NAMES[currentMonth - 1]} {currentYear}
        </p>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Trips</p>
            <p className="text-lg font-bold text-[#134e4a]">{totalTrips}</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Passengers</p>
            <p className="text-lg font-bold text-[#134e4a]">{totalPassengers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-teal-50 p-3">
            <p className="text-xs text-[#0f766e]">Active Vessels</p>
            <p className="text-lg font-bold text-[#134e4a]">{activeVesselCount}</p>
          </div>
        </div>

        {/* Waterfall */}
        <div className="mt-5 space-y-2 text-sm">
          <div className="flex justify-between border-b border-teal-100 pb-2">
            <span className="text-[#134e4a] font-medium">Platform Service Fees (admin_fee)</span>
            <span className="font-semibold text-emerald-700">{peso(totalAdminFeeCents)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-teal-200 pb-2">
            <span className="text-[#134e4a] font-medium">Payment Processing Fees (gcash_fee)</span>
            <span className="font-semibold text-blue-700">{peso(totalGcashFeeCents)}</span>
          </div>
          <div className="flex justify-between border-b-2 border-teal-300 pb-2 font-bold text-base">
            <span className="text-[#134e4a]">Gross Platform Revenue</span>
            <span className="text-[#134e4a]">{peso(grossPlatformRevenue)}</span>
          </div>

          {/* Expenses breakdown */}
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase text-rose-600 mb-1">
              Operational Expenses — split across {activeVesselCount} active vessel{activeVesselCount !== 1 ? "s" : ""} (₱{(expensePerVesselCents / 100).toLocaleString("en-PH")} each)
            </p>
            {monthlyExpenses.items.map((item) => (
              <div key={item.id} className="flex justify-between text-xs text-rose-600 pl-2 py-0.5">
                <span>− {item.name}{item.is_recurring ? " (recurring)" : " (one-time)"}</span>
                <span>{peso(-item.amount_cents)}</span>
              </div>
            ))}
            <div className="flex justify-between border-b-2 border-rose-200 pb-2 font-semibold text-rose-600 mt-1">
              <span>Total Expenses</span>
              <span>{peso(-totalExpensesCents)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-2">
            <span className="font-bold text-base text-[#134e4a]">Net Platform Revenue</span>
            <span className={`font-bold text-xl ${netPlatformRevenue < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {peso(netPlatformRevenue)}
            </span>
          </div>
          {netPlatformRevenue < 0 && (
            <p className="text-xs text-red-500 bg-red-50 rounded-lg p-2">
              ⚠ Expenses exceed fees collected this month. All pool shares are ₱0.
            </p>
          )}
        </div>
      </div>

      {/* ── SECTION 2: Per-vessel breakdown ── */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-1">
          🚢 Per-Vessel Revenue Breakdown
        </p>
        <p className="text-xs text-[#0f766e] mb-4">
          Each vessel&apos;s share of platform fees and their portion of expenses ({activeVesselCount > 0 ? `₱${(expensePerVesselCents / 100).toLocaleString("en-PH")} per vessel` : "no active vessels"}).
        </p>
        <div className="overflow-x-auto rounded-lg border border-teal-100">
          <table className="min-w-full text-sm divide-y divide-teal-100">
            <thead>
              <tr className="bg-teal-50/80">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-[#0f766e]">Vessel</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Pax</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Gross Fees</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-rose-500">Expense Share</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-[#0f766e]">Net Contribution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-teal-50">
              {activeBoatIds.map((boatId) => {
                const fees = feesByBoat.get(boatId) ?? { adminFee: 0, gcashFee: 0, passengers: 0 };
                const grossFee = fees.adminFee + fees.gcashFee;
                const netContrib = grossFee - expensePerVesselCents;
                return (
                  <tr key={boatId} className="hover:bg-teal-50/30">
                    <td className="px-4 py-2.5 font-medium text-[#134e4a]">🚢 {boatNameById.get(boatId) ?? boatId}</td>
                    <td className="px-4 py-2.5 text-right text-[#134e4a]">{fees.passengers}</td>
                    <td className="px-4 py-2.5 text-right font-semibold text-emerald-700">{peso(grossFee)}</td>
                    <td className="px-4 py-2.5 text-right text-rose-600">{peso(-expensePerVesselCents)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${netContrib < 0 ? "text-red-600" : "text-[#134e4a]"}`}>{peso(netContrib)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-teal-50 font-semibold">
                <td className="px-4 py-2.5 text-[#134e4a]">Total</td>
                <td className="px-4 py-2.5 text-right text-[#134e4a]">{totalPassengers}</td>
                <td className="px-4 py-2.5 text-right text-emerald-700">{peso(grossPlatformRevenue)}</td>
                <td className="px-4 py-2.5 text-right text-rose-600">{peso(-totalExpensesCents)}</td>
                <td className="px-4 py-2.5 text-right text-[#134e4a]">{peso(netPlatformRevenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── SECTION 3: Operator Loyalty Bonuses ── */}
      <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-bold text-amber-900 uppercase tracking-wide">
              🎁 Operator Loyalty Bonuses
            </p>
            <p className="mt-1 text-xs text-amber-700 max-w-lg">
              These are bonuses paid directly to vessel owners from <strong>their own vessel&apos;s gross platform fees</strong> — separate from the profit pool below.
              This is a thank-you reward for bringing passengers through the platform.
            </p>
          </div>
          <span className="text-2xl font-bold text-amber-900">{peso(totalLoyaltyBonusCents)}</span>
        </div>
        <div className="mt-4 overflow-x-auto rounded-lg border border-amber-200">
          <table className="min-w-full text-sm divide-y divide-amber-100 bg-white">
            <thead>
              <tr className="bg-amber-100/60">
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-amber-800">Owner</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase text-amber-800">Vessel</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-amber-800">Vessel Gross Fees</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-amber-800">Bonus %</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-amber-800">Bonus Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {loyaltyRows.map((lr, i) => (
                <tr key={i} className="hover:bg-amber-50/40">
                  <td className="px-4 py-2.5 font-medium text-amber-900">🚢 {lr.ownerName}</td>
                  <td className="px-4 py-2.5 text-amber-800">{lr.boatName}</td>
                  <td className="px-4 py-2.5 text-right text-[#134e4a]">{peso(lr.vesselGrossFeeCents)}</td>
                  <td className="px-4 py-2.5 text-right text-amber-700 font-semibold">{pct(lr.patronagePct)}</td>
                  <td className="px-4 py-2.5 text-right font-bold text-amber-900 text-base">{peso(lr.bonusCents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-amber-100/60 font-semibold">
                <td colSpan={4} className="px-4 py-2.5 text-amber-900">Total Loyalty Bonuses</td>
                <td className="px-4 py-2.5 text-right text-amber-900 text-base font-bold">{peso(totalLoyaltyBonusCents)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-amber-600">
          Formula: (Vessel&apos;s own Platform Service Fee + Payment Processing Fee) × Bonus % — calculated from snapshotted fee amounts per booking.
        </p>
      </div>

      {/* ── SECTION 4: Profit Pool Distribution ── */}
      <div className="rounded-xl border border-teal-200 bg-white p-5 shadow-sm">
        <p className="text-sm font-bold text-[#134e4a] uppercase tracking-wide mb-1">
          💰 Profit Pool Distribution — {peso(positiveNet)} net pool
        </p>
        <p className="text-xs text-[#0f766e] mb-4">
          Distributed from net platform revenue (gross fees minus expenses).
          Vessel owner shares here are <em>in addition to</em> their loyalty bonus above.
        </p>

        {totalAllocatedPercent > 100 && (
          <p className="mb-3 text-xs text-red-600 bg-red-50 rounded-lg p-2">
            ⚠ Total allocated shares exceed 100%! Adjust in investor or vessel owner settings.
          </p>
        )}

        <div className="overflow-x-auto rounded-xl border border-teal-200">
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
                    <p className={`font-medium ${
                      row.type === "investor" ? "text-amber-800" :
                      row.type === "vessel_owner" ? "text-[#0c7b93]" :
                      "text-[#134e4a]"
                    }`}>
                      {row.type === "investor" ? "💼 " : row.type === "vessel_owner" ? "🚢 " : "👤 "}
                      {row.label}
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
                <td className="px-4 py-3 text-right text-[#134e4a]">
                  {pct(totalAllocatedPercent > 100 ? totalAllocatedPercent : 100)}
                </td>
                <td className="px-4 py-3 text-right text-[#134e4a]">{peso(totalDistributed)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
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
