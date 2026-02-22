import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import { ExpensesForm } from "./ExpensesForm";

export const metadata = {
  title: "Operational Expenses",
  description: "Manage monthly operational expenses — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminExpensesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const { data: expenses, error } = await supabase
    .from("operational_expenses")
    .select("*")
    .order("is_recurring", { ascending: false })
    .order("name");

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-red-600">Failed to load expenses: {error.message}</p>
      </div>
    );
  }

  const recurringTotal = (expenses ?? []).filter((e) => e.is_recurring).reduce((s, e) => s + e.amount_cents, 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[#134e4a]">Operational Expenses</h1>
        <p className="mt-1 text-sm text-[#0f766e]">
          Track monthly recurring costs (hosting, domain, ads, etc.) that are deducted from platform revenue to calculate your net profit.
        </p>
      </div>

      {/* How it works */}
      <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0c7b93]">How profit is calculated</p>
        <div className="mt-2 space-y-1 text-xs text-[#134e4a]">
          <p>1. <strong>Gross Platform Revenue</strong> = Admin Fees + GCash Fees collected</p>
          <p>2. <strong>Net Platform Revenue</strong> = Gross Revenue − Monthly Expenses</p>
          <p>3. <strong>The Pool</strong> is then distributed to Investors, Vessel Owners, and Admin</p>
        </div>
        {recurringTotal > 0 && (
          <p className="mt-3 text-sm font-semibold text-[#0c7b93]">
            Current monthly deduction: ₱{(recurringTotal / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
          </p>
        )}
      </div>

      <div className="mt-8">
        <ExpensesForm initialExpenses={expenses ?? []} />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          View Reports
        </Link>
        <Link href="/admin/fees" className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Fee Settings
        </Link>
      </div>
    </div>
  );
}
