import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || !["admin", "tour_operator"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const {
    tour_id,
    dates,
    departure_time,
    cutoff_hours,
    joiner_slots_total,
    private_slots_total,
    exclusive_units_total,
    accepts_joiners,
    accepts_private,
    accepts_exclusive,
    notes,
  } = body;

  if (!tour_id || !dates?.length || !departure_time) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const supabase = await createClient();

  // Verify package ownership
  const { data: pkg } = await supabase
    .from("tour_packages")
    .select("id, owner_type, owner_id")
    .eq("id", tour_id)
    .single();

  if (!pkg) return NextResponse.json({ error: "Package not found" }, { status: 404 });

  // Operators can only add schedules to their own packages
  if (user.role === "tour_operator" && (pkg.owner_type !== "operator" || pkg.owner_id !== user.id)) {
    return NextResponse.json({ error: "Not authorized for this package" }, { status: 403 });
  }

  // Get existing dates to skip duplicates
  const { data: existing } = await supabase
    .from("tour_schedules")
    .select("available_date")
    .eq("tour_id", tour_id)
    .in("available_date", dates);

  const existingDates = new Set((existing ?? []).map(e => e.available_date));
  const newDates = dates.filter((d: string) => !existingDates.has(d));

  if (newDates.length === 0) {
    return NextResponse.json({
      created: 0,
      skipped: dates.length,
      message: "All dates already have schedules",
    });
  }

  // Build departure time as time string
  const deptTime = departure_time.includes(":")
    ? departure_time.slice(0, 5)
    : "07:45";

  // Build cutoff timestamps per date
  const rows = newDates.map((date: string) => {
    const cutoffDate = new Date(`${date}T${deptTime}:00+08:00`);
    cutoffDate.setHours(cutoffDate.getHours() - (cutoff_hours ?? 24));

    return {
      tour_id,
      available_date: date,
      departure_time: deptTime,
      cutoff_at: cutoffDate.toISOString(),
      accepts_joiners: accepts_joiners ?? true,
      joiner_slots_total: accepts_joiners ? (joiner_slots_total ?? 20) : 0,
      joiner_slots_booked: 0,
      accepts_private: accepts_private ?? false,
      private_slots_total: accepts_private ? (private_slots_total ?? 1) : 0,
      private_slots_booked: 0,
      accepts_exclusive: accepts_exclusive ?? false,
      exclusive_units_total: accepts_exclusive ? (exclusive_units_total ?? 1) : 0,
      exclusive_units_booked: 0,
      notes: notes ?? null,
      status: "open",
      created_by: user.id,
    };
  });

  // Insert in batches of 50
  let created = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const batch = rows.slice(i, i + 50);
    const { error } = await supabase.from("tour_schedules").insert(batch);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    created += batch.length;
  }

  return NextResponse.json({
    created,
    skipped: dates.length - newDates.length,
    message: `Created ${created} schedule${created !== 1 ? "s" : ""}${dates.length - newDates.length > 0 ? `, skipped ${dates.length - newDates.length} duplicates` : ""}`,
  });
}
