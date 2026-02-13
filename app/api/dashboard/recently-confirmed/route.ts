import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getRecentlyConfirmedBookings } from "@/lib/dashboard/get-recently-confirmed-bookings";

/** GET: Recently confirmed bookings for the current user (passenger). Used by dashboard toast polling. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const items = await getRecentlyConfirmedBookings(user.id);
  return NextResponse.json({
    items: items.map((b) => ({ reference: b.reference })),
  });
}
