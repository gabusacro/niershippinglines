import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export interface DayBreakdownRow {
  departure_date: string;
  vessel_name: string;
  boat_id: string;
  passengers: number;
  platform_fee_cents: number;
  processing_fee_cents: number;
  total_cents: number;
}

export interface FeeBreakdownResponse {
  rows: DayBreakdownRow[];
  total_platform_fee_cents: number;
  total_processing_fee_cents: number;
  total_passengers: number;
  start: string;
  end: string;
}

// GET /api/admin/fee-breakdown?start=2026-03-01&end=2026-03-31
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end   = searchParams.get("end");
  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  const supabase = await createClient();
  const PAID = ["confirmed", "checked_in", "boarded", "completed"];

  const { data, error } = await supabase
    .from("bookings")
    .select(`
      passenger_count,
      admin_fee_cents,
      gcash_fee_cents,
      total_amount_cents,
      status,
      trip:trips!bookings_trip_id_fkey(
        departure_date,
        boat:boats!trips_boat_id_fkey(id, name)
      )
    `)
    .in("status", PAID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by date + vessel
  const map = new Map<string, DayBreakdownRow>();

  for (const b of data ?? []) {
    const trip = Array.isArray(b.trip) ? b.trip[0] : b.trip;
    if (!trip) continue;
    const date = trip.departure_date as string;
    if (date < start || date > end) continue;

    const boat = Array.isArray(trip.boat) ? trip.boat[0] : trip.boat;
    const boatId   = (boat as { id: string } | null)?.id ?? "";
    const boatName = (boat as { name: string } | null)?.name ?? "Unknown";
    const key = `${date}__${boatId}`;

    if (!map.has(key)) {
      map.set(key, {
        departure_date: date,
        vessel_name: boatName,
        boat_id: boatId,
        passengers: 0,
        platform_fee_cents: 0,
        processing_fee_cents: 0,
        total_cents: 0,
      });
    }
    const row = map.get(key)!;
    row.passengers           += b.passenger_count ?? 0;
    row.platform_fee_cents   += b.admin_fee_cents ?? 0;
    row.processing_fee_cents += b.gcash_fee_cents ?? 0;
    row.total_cents          += b.total_amount_cents ?? 0;
  }

  const rows = Array.from(map.values())
    .sort((a, b) => a.departure_date.localeCompare(b.departure_date) || a.vessel_name.localeCompare(b.vessel_name));

  const total_platform_fee_cents   = rows.reduce((s, r) => s + r.platform_fee_cents, 0);
  const total_processing_fee_cents = rows.reduce((s, r) => s + r.processing_fee_cents, 0);
  const total_passengers           = rows.reduce((s, r) => s + r.passengers, 0);

  return NextResponse.json({
    rows,
    total_platform_fee_cents,
    total_processing_fee_cents,
    total_passengers,
    start,
    end,
  } satisfies FeeBreakdownResponse);
}
