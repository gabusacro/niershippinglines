import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { UserManagementClient } from "./UserManagementClient";

export const metadata = {
  title: "User Management",
  description: "Manage user roles and accounts — Travela Siargao Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const supabase = await createClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, created_at, approved_at, mobile, address")
    .order("created_at", { ascending: false });

  // Get booking counts per user
  const profileIds = (profiles ?? []).map((p) => p.id);
  const bookingCounts = new Map<string, number>();

  if (profileIds.length > 0) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("created_by")
      .in("created_by", profileIds)
      .not("status", "in", '("cancelled","refunded")');

    for (const b of bookings ?? []) {
      if (b.created_by) {
        bookingCounts.set(b.created_by, (bookingCounts.get(b.created_by) ?? 0) + 1);
      }
    }
  }

  const users = (profiles ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name ?? null,
    email: p.email ?? null,
    role: p.role ?? "passenger",
    created_at: p.created_at,
    approved_at: p.approved_at ?? null,
    mobile: p.mobile ?? null,
    address: p.address ?? null,
    booking_count: bookingCounts.get(p.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">👥 User Management</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            View all registered users, change roles, and manage accounts.
            Role changes take effect immediately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-teal-100 px-3 py-1 font-medium text-teal-800">
            {users.length} total users
          </span>
          <span className="rounded-full bg-purple-100 px-3 py-1 font-medium text-purple-800">
            {users.filter((u) => u.role === "passenger").length} passengers
          </span>
          <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-800">
            {users.filter((u) => ["captain", "crew", "ticket_booth"].includes(u.role)).length} staff
          </span>
        </div>
      </div>

      <div className="mt-6">
        <UserManagementClient users={users} currentUserId={user.id} />
      </div>
    </div>
  );
}
