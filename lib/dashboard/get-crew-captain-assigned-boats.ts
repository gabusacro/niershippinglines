import { createClient } from "@/lib/supabase/server";

/**
 * Returns boat IDs that this profile is assigned to as captain or deck_crew.
 * Used to scope crew/captain dashboard to their vessel(s) only.
 */
export async function getCrewCaptainAssignedBoatIds(profileId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boat_assignments")
    .select("boat_id")
    .eq("profile_id", profileId)
    .in("assignment_role", ["captain", "deck_crew"]);

  if (error) return [];
  return (data ?? []).map((r) => r.boat_id);
}
