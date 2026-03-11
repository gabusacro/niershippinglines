import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { booking_id, tour_operator_id } = await request.json();
  if (!booking_id) {
    return NextResponse.json({ error: "Missing booking_id" }, { status: 400 });
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("tour_bookings")
    .update({ tour_operator_id: tour_operator_id || null, updated_at: new Date().toISOString() })
    .eq("id", booking_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}