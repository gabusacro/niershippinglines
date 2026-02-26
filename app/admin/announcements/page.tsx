import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { AnnouncementsClient } from "./AnnouncementsClient";

export const metadata = {
  title: "Announcements",
  description: "Manage passenger announcements — Travela Siargao Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    redirect(ROUTES.dashboard);
  }

  const supabase = await createClient();

  const [{ data: announcements }, { data: boats }] = await Promise.all([
    supabase
      .from("vessel_announcements")
      .select("id, message, vessel_id, created_by, created_at, active_until")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("boats")
      .select("id, name")
      .order("name"),
  ]);

  const creatorIds = [...new Set((announcements ?? []).map((a) => a.created_by).filter(Boolean) as string[])];
  const creatorNames = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", creatorIds);
    for (const p of profiles ?? []) {
      creatorNames.set(p.id, p.full_name ?? "Unknown");
    }
  }

  const vesselMap = new Map((boats ?? []).map((b) => [b.id, b.name]));
  const now = new Date();

  const items = (announcements ?? []).map((a) => ({
    id: a.id,
    message: a.message,
    vessel_id: a.vessel_id ?? null,
    vessel_name: a.vessel_id ? (vesselMap.get(a.vessel_id) ?? null) : null,
    created_by: a.created_by ?? null,
    created_by_name: a.created_by ? (creatorNames.get(a.created_by) ?? "Unknown") : "Unknown",
    created_at: a.created_at,
    active_until: a.active_until ?? null,
    is_active: !a.active_until || new Date(a.active_until) > now,
  }));

  const vessels = (boats ?? []).map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>

      <div className="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">📢 Announcements</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Post updates for passengers. They appear on the Schedule and Book pages.
            Tag to a specific vessel or broadcast to all.
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${items.filter(i => i.is_active).length > 0 ? "bg-amber-100 text-amber-800" : "bg-gray-100 text-gray-500"}`}>
          {items.filter(i => i.is_active).length} active
        </span>
      </div>

      <AnnouncementsClient
        initialItems={items}
        vessels={vessels}
        currentUserId={user.id}
        isAdmin={user.role === "admin"}
      />
    </div>
  );
}
