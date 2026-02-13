import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { FlaggedListActions } from "./FlaggedListActions";

export const metadata = {
  title: "Flagged accounts",
  description: "Passengers with warnings or booking restrictions — Nier Shipping Lines Admin",
};

export const dynamic = "force-dynamic";

type RestrictionRow = {
  profile_id: string;
  booking_warnings: number;
  booking_blocked_at: string | null;
  blocked_until: string | null;
  updated_at: string;
  profiles: { email: string | null; full_name: string | null } | null;
};


export default async function AdminFlaggedPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) redirect(ROUTES.dashboard);

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("passenger_booking_restrictions")
    .select("profile_id, booking_warnings, booking_blocked_at, blocked_until, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-red-600">Unable to load flagged accounts. {error.message}</p>
        <Link href={ROUTES.admin} className="mt-4 inline-block text-[#0c7b93] font-medium hover:underline">← Admin dashboard</Link>
      </div>
    );
  }

  const restrictionList = (rows ?? []) as { profile_id: string; booking_warnings: number; booking_blocked_at: string | null; blocked_until: string | null; updated_at: string }[];
  // Only show currently flagged: has warnings or is blocked (indefinite or temp)
  const currentlyFlagged = restrictionList.filter((r) => {
    if (r.booking_warnings >= 1) return true;
    if (r.booking_blocked_at) return true;
    if (r.blocked_until && new Date(r.blocked_until) > new Date()) return true;
    return false;
  });
  const profileIds = currentlyFlagged.map((r) => r.profile_id);
  const { data: profiles } = profileIds.length > 0
    ? await supabase.from("profiles").select("id, email, full_name").in("id", profileIds)
    : { data: [] };
  const profileMap = new Map((profiles ?? []).map((p) => [p.id, { email: p.email ?? null, full_name: p.full_name ?? null }]));

  const list: RestrictionRow[] = currentlyFlagged.map((r) => ({
    ...r,
    profiles: profileMap.get(r.profile_id) ?? null,
  }));

  const backHref = user.role === "ticket_booth" ? ROUTES.dashboard : ROUTES.admin;
  const backLabel = user.role === "ticket_booth" ? "← Dashboard" : "← Admin dashboard";

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <Link href={backHref} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        {backLabel}
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#134e4a]">Flagged accounts</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Passengers who received a warning or were restricted from booking (spam). Use <strong>Lift</strong> to remove the restriction so they can book again.
      </p>

      {list.length === 0 ? (
        <div className="mt-6 rounded-xl border-2 border-teal-200 bg-white p-8 text-center">
          <p className="font-medium text-[#134e4a]">No flagged accounts</p>
          <p className="mt-1 text-sm text-[#0f766e]">When you issue a warning or mark a booking as spam from Pending Payments, those accounts will appear here.</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {list.map((r) => {
            const email = r.profiles?.email ?? "—";
            const name = r.profiles?.full_name?.trim() ?? "—";
            const isBlockedIndefinite = !!r.booking_blocked_at;
            const isBlockedTemp = r.blocked_until && new Date(r.blocked_until) > new Date();
            const blockedLabel = isBlockedIndefinite ? "Blocked (indefinite)" : isBlockedTemp ? `Blocked until ${new Date(r.blocked_until!).toLocaleDateString("en-PH", { dateStyle: "medium" })}` : "—";
            return (
              <div
                key={r.profile_id}
                className="flex flex-col gap-3 rounded-xl border-2 border-amber-200 bg-amber-50/50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-[#134e4a]">{name}</p>
                  <p className="text-sm text-[#0f766e]">{email}</p>
                  <p className="mt-2 text-xs font-medium text-amber-800">
                    Warnings: {r.booking_warnings} · {blockedLabel}
                  </p>
                </div>
                <FlaggedListActions profileId={r.profile_id} />
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href={ROUTES.adminPendingPayments} className="rounded-xl border-2 border-teal-200 px-5 py-2.5 text-sm font-semibold text-[#134e4a] hover:bg-teal-50">
          Pending Payments
        </Link>
        <Link href={backHref} className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10">
          {user.role === "ticket_booth" ? "Dashboard" : "Admin dashboard"}
        </Link>
      </div>
    </div>
  );
}
