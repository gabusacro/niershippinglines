import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import TeamClient from "./TeamClient";

export const metadata = {
  title: "Tour Team — Admin",
};

export default async function TourTeamPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();

  const { data: operators } = await supabase
    .from("profiles")
    .select("id, full_name, email, mobile, created_at")
    .eq("role", "tour_operator")
    .order("full_name");

  const { data: guides } = await supabase
    .from("profiles")
    .select("id, full_name, email, mobile, created_at")
    .eq("role", "tour_guide")
    .order("full_name");

  const { data: rawAssignments } = await supabase
    .from("tour_guide_assignments")
    .select("id, tour_operator_id, tour_guide_id, is_active, assigned_at")
    .eq("is_active", true)
    .order("assigned_at", { ascending: false });

  const allProfileIds = [
    ...new Set([
      ...(rawAssignments ?? []).map((a) => a.tour_operator_id),
      ...(rawAssignments ?? []).map((a) => a.tour_guide_id),
    ])
  ];

  const { data: allProfiles } = allProfileIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", allProfileIds)
    : { data: [] };

  const profileMap = Object.fromEntries((allProfiles ?? []).map((p) => [p.id, p]));

  const assignments = (rawAssignments ?? []).map((a) => ({
    ...a,
    operator: profileMap[a.tour_operator_id] ?? null,
    guide: profileMap[a.tour_guide_id] ?? null,
  }));

  return (
    <TeamClient
      operators={operators ?? []}
      guides={guides ?? []}
      assignments={assignments}
      adminId={user.id}
    />
  );
}

