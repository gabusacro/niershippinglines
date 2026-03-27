import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "parking_owner", "parking_crew"];
  if (!allowed.includes(user.role as string))
    return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const q = request.nextUrl.searchParams.get("q")?.trim();
  if (!q) return NextResponse.json(null);

  const supabase = await createClient();

  // Search by reference first
  const { data: byRef } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, vehicle_count, vehicles, customer_full_name, lot_snapshot_name, checked_in_at, checked_out_at")
    .ilike("reference", `%${q}%`)
    .not("status", "in", '("cancelled")')
    .limit(1)
    .maybeSingle();

  if (byRef) return NextResponse.json(byRef);

  // Search by plate number in vehicles JSONB
  const { data: byPlate } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, park_date_start, park_date_end, vehicle_count, vehicles, customer_full_name, lot_snapshot_name, checked_in_at, checked_out_at")
    .not("status", "in", '("cancelled","completed")')
    .order("created_at", { ascending: false })
    .limit(50);

  const plateUpper = q.toUpperCase().replace(/\s/g, "");
  const match = (byPlate ?? []).find(b =>
    (b.vehicles as { plate_number: string }[])?.some(v =>
      v.plate_number.replace(/\s/g, "").toUpperCase() === plateUpper
    )
  );

  return NextResponse.json(match ?? null);
}