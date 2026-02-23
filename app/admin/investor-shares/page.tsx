import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import { InvestorSharesForm } from "./InvestorSharesForm";

export const metadata = {
  title: "Investor Shares",
  description: "Manage investor profit shares — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminInvestorSharesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();

  const [{ data: investors }, { data: shares }, { data: allProfiles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("role", "investor").order("full_name"),
    supabase.from("investor_shares").select("id, investor_id, share_percent, notes, created_at").order("created_at"),
    supabase.from("profiles").select("id, full_name, role").neq("role", "admin").order("full_name"),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[#134e4a]">Investor Shares</h1>
        <p className="mt-1 text-sm text-[#0f766e]">
          Promote users to Investor role and set their percentage share of the monthly net platform revenue pool.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">How Investor Shares work</p>
        <div className="mt-2 space-y-1 text-xs text-amber-800">
          <p>1. <strong>Net Platform Revenue</strong> = Admin + Payment Processing Fees − Monthly Expenses</p>
          <p>2. Each investor receives their <strong>Share %</strong> of the Net Platform Revenue monthly</p>
          <p>3. Vessel owners also receive their patronage bonus % from the same pool</p>
          <p>4. <strong>Admin keeps the remainder</strong> after all investor + vessel owner shares are paid out</p>
          <p>5. Total shares across all investors + vessel owners should not exceed 100%</p>
        </div>
      </div>

      <div className="mt-8">
        <InvestorSharesForm
          initialInvestors={(investors ?? []).map((i) => ({ id: i.id, full_name: i.full_name ?? null, role: i.role ?? "" }))}
          initialShares={(shares ?? []).map((s) => ({ id: s.id, investor_id: s.investor_id, share_percent: Number(s.share_percent ?? 0), notes: s.notes ?? null }))}
          allProfiles={(allProfiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? null, role: p.role ?? "" }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href="/admin/vessel-owners" className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Vessel Owners
        </Link>
        <Link href="/admin/expenses" className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Expenses
        </Link>
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Reports
        </Link>
      </div>
    </div>
  );
}
