import { createClient } from "@/lib/supabase/server";

export interface AnnouncementDisplay {
  id: string;
  message: string;
  vesselName: string | null;
  createdAt: string;
}

/**
 * Fetches active announcements for public display (Schedule, Book pages).
 * vessel_id null = "All vessels"; otherwise includes boat name.
 * Excludes announcements past active_until.
 */
export async function getActiveAnnouncements(): Promise<AnnouncementDisplay[]> {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("vessel_announcements")
    .select("id, message, vessel_id, created_at, active_until")
    .or(`active_until.is.null,active_until.gte.${now}`)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error || !data?.length) return [];

  const vesselIds = [...new Set((data.map((a) => a.vessel_id).filter(Boolean) as string[]))];
  const vesselNames = new Map<string, string>();
  if (vesselIds.length > 0) {
    const { data: boats } = await supabase
      .from("boats")
      .select("id, name")
      .in("id", vesselIds);
    for (const b of boats ?? []) {
      vesselNames.set(b.id, b.name);
    }
  }

  return data.map((a) => ({
    id: a.id,
    message: a.message,
    vesselName: a.vessel_id ? vesselNames.get(a.vessel_id) ?? null : null,
    createdAt: a.created_at,
  }));
}
