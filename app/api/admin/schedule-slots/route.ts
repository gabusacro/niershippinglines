import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET ?route_id= — Returns departure times for the route (used by Add trips form).
 * GET (no params) — Admin: returns all slots grouped by route.
 */
function formatTimeLabel(t: string): string {
  if (!t) return "";
  const s = String(t).slice(0, 8);
  const [h, m] = s.split(":");
  const hh = parseInt(h ?? "0", 10);
  const am = hh < 12;
  const h12 = hh === 0 ? 12 : hh > 12 ? hh - 12 : hh;
  return `${h12}:${m ?? "00"} ${am ? "AM" : "PM"}`;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const routeId = searchParams.get("route_id");
  const supabase = await createClient();

  if (routeId) {
    const { data, error } = await supabase
      .from("schedule_slots")
      .select("departure_time")
      .eq("route_id", routeId)
      .eq("is_active", true)
      .order("departure_time");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const times = (data ?? []).map((row) => {
      const raw = row.departure_time;
      const timeStr = typeof raw === "string" ? raw : "";
      return { departure_time: timeStr, label: formatTimeLabel(timeStr) };
    });
    return NextResponse.json({ times });
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: slots, error } = await supabase
    .from("schedule_slots")
    .select("id, route_id, departure_time, is_active")
    .order("route_id")
    .order("departure_time");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: routes } = await supabase
    .from("routes")
    .select("id, display_name, origin, destination")
    .order("display_name");
  const routesMap = new Map((routes ?? []).map((r) => [r.id, r]));
  const grouped = (slots ?? []).map((s) => ({
    ...s,
    route_name: routesMap.get(s.route_id)?.display_name ?? s.route_id,
    label: formatTimeLabel(String(s.departure_time ?? "")),
  }));
  return NextResponse.json({ slots: grouped });
}

/** POST: Add a departure time for a route. Admin only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { route_id?: string; departure_time?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const routeId = body.route_id?.trim();
  const timeStr = body.departure_time?.trim();
  if (!routeId || !timeStr) return NextResponse.json({ error: "Missing route_id or departure_time" }, { status: 400 });

  const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
  if (!match) return NextResponse.json({ error: "departure_time must be HH:MM or HH:MM:SS" }, { status: 400 });
  const h = parseInt(match[1]!, 10);
  const m = parseInt(match[2]!, 10);
  const s = match[3] ? parseInt(match[3], 10) : 0;
  if (h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) {
    return NextResponse.json({ error: "Invalid time" }, { status: 400 });
  }
  const normalized = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("schedule_slots")
    .insert({ route_id: routeId, departure_time: normalized, is_active: true })
    .select("id, route_id, departure_time")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
