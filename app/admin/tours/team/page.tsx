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

  // Get all tour operators
  const { data: operators } = await supabase
    .from("profiles")
    .select("id, full_name, email, mobile, created_at")
    .eq("role", "tour_operator")
    .order("full_name");

  // Get all tour guides
  const { data: guides } = await supabase
    .from("profiles")
    .select("id, full_name, email, mobile, created_at")
    .eq("role", "tour_guide")
    .order("full_name");

  // Get all guide assignments
  const { data: assignments } = await supabase
    .from("tour_guide_assignments")
    .select("*, operator:tour_operator_id(full_name, email), guide:tour_guide_id(full_name, email)")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <TeamClient
      operators={operators ?? []}
      guides={guides ?? []}
      assignments={assignments ?? []}
      adminId={user.id}
    />
  );
}
