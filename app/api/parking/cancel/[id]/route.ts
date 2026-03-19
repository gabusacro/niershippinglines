import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const supabase = await createClient();

  // Fetch booking — must belong to this user
  const { data: booking } = await supabase
    .from("parking_reservations")
    .select("id, reference, status, customer_profile_id")
    .eq("id", id)
    .eq("customer_profile_id", user.id)
    .maybeSingle();

  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "pending_payment")
    return NextResponse.json({ error: "Only pending bookings can be cancelled." }, { status: 409 });

  // Cancel it
  const { error: updateErr } = await supabase
    .from("parking_reservations")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (updateErr) {
    console.error("[cancel] update error:", updateErr);
    return NextResponse.json({ error: "Failed to cancel booking. Please try again." }, { status: 500 });
  }

  // Log it
  await supabase.from("parking_reservation_logs").insert({
    reservation_id: id,
    event_type:     "cancelled",
    performed_by:   user.id,
    notes:          `Booking cancelled by customer. Reference: ${booking.reference}.`,
  });

  return NextResponse.json({ ok: true });
}
