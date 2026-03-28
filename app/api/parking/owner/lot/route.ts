import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// Allows parking_owner to update their own lot's slots, rates, and settings
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = user.role as string;
  if (!["admin", "parking_owner"].includes(role))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (!body.id) return NextResponse.json({ error: "lot id required." }, { status: 400 });

  const supabase = await createClient();

  // Verify owner owns this lot
  if (role === "parking_owner") {
    const { data: lot } = await supabase
      .from("parking_lots")
      .select("owner_id")
      .eq("id", body.id as string)
      .maybeSingle();
    if (lot?.owner_id !== user.id)
      return NextResponse.json({ error: "You do not own this lot." }, { status: 403 });
  }

  const { error } = await supabase
    .from("parking_lots")
    .update({
      total_slots_car:        body.total_slots_car,
      total_slots_motorcycle: body.total_slots_motorcycle,
      total_slots_van:        body.total_slots_van,
      accepts_car:            body.accepts_car,
      accepts_motorcycle:     body.accepts_motorcycle,
      accepts_van:            body.accepts_van,
      car_rate_cents:         body.car_rate_cents ?? null,
      motorcycle_rate_cents:  body.motorcycle_rate_cents ?? null,
      van_rate_cents:         body.van_rate_cents ?? null,
      is_24hrs:               body.is_24hrs,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", body.id as string);

  if (error) {
    console.error("[owner/lot] update error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
