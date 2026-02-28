import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getMonthlyExpenses } from "@/lib/admin/reports-stats";
import { ROUTES } from "@/lib/constants";
import { InvestorPayoutsClient } from "./InvestorPayoutsClient";

export const metadata = {
  title: "Investor Payouts",
  description: "Manage investor monthly profit share payouts — Admin",
};

export const dynamic = "force-dynamic";

const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const PAYMENT_STATUSES = ["confirmed","checked_in","boarded","completed"];

function buildMonthRange(year: number, month: number) {
  const monthStr   = String(month).padStart(2, "0");
  const monthStart = `${year}-${monthStr}-01`;
  const lastDay    = new Date(year, month, 0).getDate();
  const monthEnd   = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { monthStart, monthEnd };
}

export default async function AdminInvestorPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const params = await searchParams;
  const supabase = await createClient();
  const now = new Date();
  const currentYear  = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(0, 4), 10);
  const currentMonth = parseInt(now.toLocaleDateString("en-CA", { timeZone: "Asia/Manila" }).slice(5, 7), 10);

  const selectedYear  = parseInt(params.year  ?? String(currentYear),  10);
  const selectedMonth = parseInt(params.month ?? String(currentMonth), 10);

  // ── Revenue calculation for selected month ──────────────────────────────
  const { monthStart, monthEnd } = buildMonthRange(selectedYear, selectedMonth);

  const { data: trips } = await supabase
    .from("trips")
    .select("id, boat_id")
    .gte("departure_date", monthStart)
    .lte("departure_date", monthEnd);

  const tripIds = (trips ?? []).map((t) => t.id);
  const activeBoatIds = [...new Set((trips ?? []).map((t) => t.boat_id).filter(Boolean))];

  let platformFeeCents = 0, processingFeeCents = 0, totalPassengers = 0;

  if (tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, admin_fee_cents, gcash_fee_cents, passenger_count")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);
    for (const b of bookings ?? []) {
      platformFeeCents   += b.admin_fee_cents ?? 0;
      processingFeeCents += b.gcash_fee_cents ?? 0;
      totalPassengers    += b.passenger_count ?? 0;
    }
  }

  const grossCents = platformFeeCents + processingFeeCents;

  // Vessel owner bonus deductions
  const { data: assignments } = await supabase
    .from("vessel_assignments")
    .select("boat_id, patronage_bonus_percent, boat:boats(name), owner:profiles(full_name)");

  let vesselBonusCents = 0;
  const vesselBonusLines: { boatName: string; ownerName: string; pct: number; bonusCents: number }[] = [];

  if ((assignments ?? []).length > 0 && tripIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("trip_id, admin_fee_cents, gcash_fee_cents")
      .in("trip_id", tripIds)
      .in("status", PAYMENT_STATUSES);

    const tripToBoat = new Map<string, string>();
    for (const t of trips ?? []) { if (t.boat_id) tripToBoat.set(t.id, t.boat_id); }

    const feesByBoat = new Map<string, number>();
    for (const b of bookings ?? []) {
      const boatId = tripToBoat.get(b.trip_id);
      if (boatId) feesByBoat.set(boatId, (feesByBoat.get(boatId) ?? 0) + (b.admin_fee_cents ?? 0) + (b.gcash_fee_cents ?? 0));
    }

    for (const a of assignments ?? []) {
      const boat  = (a as { boat?: { name?: string } | null }).boat;
      const owner = (a as { owner?: { full_name?: string } | null }).owner;
      const fees  = feesByBoat.get(a.boat_id) ?? 0;
      const pct   = Number(a.patronage_bonus_percent);
      const bonus = Math.round(fees * (pct / 100));
      vesselBonusCents += bonus;
      vesselBonusLines.push({
        boatName: boat?.name ?? "—",
        ownerName: owner?.full_name ?? "—",
        pct, bonusCents: bonus,
      });
    }
  }

  const expenses = await getMonthlyExpenses(supabase, selectedYear, selectedMonth);
  const netPoolCents = Math.max(0, grossCents - vesselBonusCents - expenses.totalCents);

  // ── All investors ────────────────────────────────────────────────────────
  const { data: investorShares } = await supabase
    .from("investor_shares")
    .select("investor_id, share_percent, notes, investor:profiles(id, full_name, email)")
    .order("share_percent", { ascending: false });

  // Existing payout records for this month
  const investorIds = (investorShares ?? []).map((s) => s.investor_id);
  const { data: payouts } = investorIds.length > 0
    ? await supabase
        .from("investor_payouts")
        .select("*")
        .in("investor_id", investorIds)
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
    : { data: [] };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payoutByInvestor = new Map<string, any>();
  for (const p of payouts ?? []) {
    if (p) payoutByInvestor.set(p.investor_id, p);
  }

  // Build investor rows
  type InvestorRow = {
    investorId: string;
    fullName: string;
    email: string;
    sharePercent: number;
    notes: string;
    shareCents: number;
    payoutId: string | null;
    status: "pending" | "paid";
    paymentReference: string | null;
    paymentNotes: string | null;
    paidAt: string | null;
    netPoolCents: number;
  };

  const investorRows: InvestorRow[] = (investorShares ?? []).map((s) => {
    const investor = (s as { investor?: { id?: string; full_name?: string; email?: string } | null }).investor;
    const shareCents = Math.round(netPoolCents * (Number(s.share_percent) / 100));
    const payout = payoutByInvestor.get(s.investor_id);
    return {
      investorId: s.investor_id,
      fullName: investor?.full_name ?? "Unnamed Investor",
      email: investor?.email ?? "—",
      sharePercent: Number(s.share_percent),
      notes: s.notes ?? "Silent Investor",
      shareCents,
      payoutId: payout?.id ?? null,
      status: (payout?.status as "pending" | "paid") ?? "pending",
      paymentReference: payout?.payment_reference ?? null,
      paymentNotes: payout?.payment_notes ?? null,
      paidAt: payout?.paid_at ?? null,
      netPoolCents,
    };
  });

  // ── All-time payout history ──────────────────────────────────────────────
  const { data: allPayouts } = investorIds.length > 0
    ? await supabase
        .from("investor_payouts")
        .select("*, investor:profiles(full_name)")
        .in("investor_id", investorIds)
        .order("year", { ascending: false })
        .order("month", { ascending: false })
    : { data: [] };

  return (
    <InvestorPayoutsClient
      selectedYear={selectedYear}
      selectedMonth={selectedMonth}
      currentYear={currentYear}
      currentMonth={currentMonth}
      revenue={{
        totalPassengers, activeVessels: activeBoatIds.length,
        totalTrips: tripIds.length,
        platformFeeCents, processingFeeCents, grossCents,
        vesselBonusCents, vesselBonusLines,
        expenseCents: expenses.totalCents,
        expenseItems: expenses.items,
        netPoolCents,
      }}
      investorRows={investorRows}
      allPayouts={(allPayouts ?? []).map((p) => ({
        id: p.id,
        investorId: p.investor_id,
        investorName: (p as { investor?: { full_name?: string } | null }).investor?.full_name ?? "—",
        year: p.year,
        month: p.month,
        netPoolCents: p.net_pool_cents ?? 0,
        shareCents: p.share_cents ?? 0,
        sharePercent: p.share_percent ?? 0,
        status: p.status as "pending" | "paid",
        paymentReference: p.payment_reference ?? null,
        paymentNotes: p.payment_notes ?? null,
        paidAt: p.paid_at ?? null,
      }))}
    />
  );
}
