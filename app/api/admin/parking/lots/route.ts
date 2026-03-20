import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();

  const { data: lots } = await supabase
    .from("parking_lots")
    .select("id, name, slug, address, distance_from_port, total_slots_car, total_slots_motorcycle, total_slots_van, accepts_car, accepts_motorcycle, accepts_van, car_rate_cents, motorcycle_rate_cents, van_rate_cents, is_active, is_24hrs")
    .order("name");

  const { data: avail } = await supabase
    .from("parking_slot_availability")
    .select("lot_id, booked_car, booked_motorcycle, booked_van, total_slots_car, total_slots_motorcycle, total_slots_van");

  const availMap = new Map((avail ?? []).map(a => [a.lot_id, a]));

  const result = (lots ?? []).map(lot => {
    const a = availMap.get(lot.id);
    return {
      ...lot,
      available_car:        (a?.total_slots_car        ?? lot.total_slots_car)        - (a?.booked_car        ?? 0),
      available_motorcycle: (a?.total_slots_motorcycle ?? lot.total_slots_motorcycle) - (a?.booked_motorcycle ?? 0),
      available_van:        (a?.total_slots_van        ?? lot.total_slots_van)        - (a?.booked_van        ?? 0),
    };
  });

  return NextResponse.json(result);
}

// POST — update existing lot
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const supabase = await createClient();
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
      is_active:              body.is_active,
      is_24hrs:               body.is_24hrs,
      updated_at:             new Date().toISOString(),
    })
    .eq("id", body.id as string);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// PUT — create new lot
export async function PUT(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  if (!body.name || !body.address)
    return NextResponse.json({ error: "Name and address are required." }, { status: 400 });

  const supabase = await createClient();

  // Check slug uniqueness
  const slug = (body.slug as string) || (body.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const { data: existing } = await supabase
    .from("parking_lots").select("id").eq("slug", slug).maybeSingle();
  if (existing)
    return NextResponse.json({ error: `Slug "${slug}" already exists. Choose a different name.` }, { status: 409 });

  const { data, error } = await supabase
    .from("parking_lots")
    .insert({
      name:                  body.name,
      slug,
      address:               body.address,
      distance_from_port:    body.distance_from_port || null,
      total_slots_car:       body.total_slots_car ?? 0,
      total_slots_motorcycle: body.total_slots_motorcycle ?? 0,
      total_slots_van:       body.total_slots_van ?? 0,
      accepts_car:           body.accepts_car ?? true,
      accepts_motorcycle:    body.accepts_motorcycle ?? true,
      accepts_van:           body.accepts_van ?? false,
      car_rate_cents:        body.car_rate_cents ?? null,
      motorcycle_rate_cents: body.motorcycle_rate_cents ?? null,
      van_rate_cents:        body.van_rate_cents ?? null,
      is_active:             body.is_active ?? true,
      is_24hrs:              body.is_24hrs ?? true,
      created_by:            user.id,
    })
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: data.id });
}
