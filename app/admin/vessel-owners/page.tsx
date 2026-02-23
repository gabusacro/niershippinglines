import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { ROUTES } from "@/lib/constants";
import { VesselOwnersForm } from "../../api/admin/vessel-owners/VesselOwnersForm";

export const metadata = {
  title: "Vessel Owners",
  description: "Assign vessels to owners and manage patronage bonuses — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminVesselOwnersPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();

  const [{ data: owners }, { data: boats }, { data: assignments }, { data: allProfiles }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, role").eq("role", "vessel_owner").order("full_name"),
    supabase.from("boats").select("id, name").order("name"),
    supabase.from("vessel_assignments").select("id, vessel_owner_id, boat_id, patronage_bonus_percent, assigned_at, boat:boats(id, name)").order("assigned_at"),
    supabase.from("profiles").select("id, full_name, role").neq("role", "admin").order("full_name"),
  ]);

  // Normalize assignments to match VesselOwnersForm's expected type
  const normalizedAssignments = (assignments ?? []).map((a) => ({
    id: a.id,
    vessel_owner_id: a.vessel_owner_id,
    boat_id: a.boat_id,
    patronage_bonus_percent: Number(a.patronage_bonus_percent ?? 0),
    assigned_at: a.assigned_at ?? "",
    boat: Array.isArray(a.boat) ? (a.boat[0] ?? null) : (a.boat ?? null),
  }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4">
        <h1 className="text-2xl font-bold text-[#134e4a]">Vessel Owners</h1>
        <p className="mt-1 text-sm text-[#0f766e]">
          Promote users to Vessel Owner role, assign their vessel, and set their patronage bonus percentage from the net platform revenue pool.
        </p>
      </div>

      <div className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#0c7b93]">How Patronage Bonus works</p>
        <div className="mt-2 space-y-1 text-xs text-[#134e4a]">
          <p>1. <strong>Net Platform Revenue</strong> = Admin + Payment Processing Fees − Monthly Expenses</p>
          <p>2. Each vessel owner receives their <strong>Patronage Bonus %</strong> of the Net Platform Revenue</p>
          <p>3. Vessel owners also keep <strong>100% of their vessel&apos;s fare revenue</strong> (minus fuel)</p>
          <p>4. The patronage bonus is their share of the platform fees pool — a reward for bringing passengers</p>
        </div>
      </div>

      <div className="mt-8">
        <VesselOwnersForm
          initialOwners={(owners ?? []).map((o) => ({ id: o.id, full_name: o.full_name ?? null, role: o.role ?? "" }))}
          initialBoats={(boats ?? []).map((b) => ({ id: b.id, name: b.name }))}
          initialAssignments={normalizedAssignments}
          allProfiles={(allProfiles ?? []).map((p) => ({ id: p.id, full_name: p.full_name ?? null, role: p.role ?? "" }))}
        />
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={ROUTES.adminReports} className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Reports
        </Link>
        <Link href="/admin/expenses" className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Expenses
        </Link>
      </div>
    </div>
  );
}
