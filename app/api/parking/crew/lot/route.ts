import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextResponse } from "next/server";

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "parking_owner", "parking_crew"];
  if (!allowed.includes(user.role as string))
    return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const supabase = await createClient();

  let lotId: string | null = null;

  if ((user.role as string) === "parking_crew") {
    const { data } = await supabase
      .from("parking_lot_crew")
      .select("lot_id")
      .eq("crew_id", user.id)
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    lotId = data?.lot_id ?? null;
  } else if ((user.role as string) === "parking_owner") {
    const { data } = await supabase
      .from("parking_lots")
      .select("id")
      .eq("owner_id", user.id)
      .limit(1)
      .maybeSingle();
    lotId = data?.id ?? null;
  }

  if (!lotId) return NextResponse.json({ lot: null, availability: null });

  const [{ data: lot }, { data: avail }] = await Promise.all([
    supabase
      .from("parking_lots")
      .select("id, name, total_slots_car, total_slots_motorcycle, total_slots_van, distance_from_port")
      .eq("id", lotId)
      .maybeSingle(),
    supabase
      .from("parking_slot_availability")
      .select("booked_car, booked_motorcycle, booked_van")
      .eq("lot_id", lotId)
      .maybeSingle(),
  ]);

  return NextResponse.json({ lot, availability: avail });
}
