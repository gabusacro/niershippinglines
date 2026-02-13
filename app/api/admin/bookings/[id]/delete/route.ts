import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

/** DELETE: Remove a spam/unwanted booking (pending_payment only). Admin or ticket_booth. Releases trip inventory. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "ticket_booth") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  const { data: booking, error: fetchErr } = await admin
    .from("bookings")
    .select("id, status, trip_id, is_walk_in, passenger_count")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if (booking.status !== "pending_payment") {
    return NextResponse.json(
      { error: "Only pending-payment bookings can be deleted (spam removal). Use refund for confirmed bookings." },
      { status: 400 }
    );
  }

  // Delete tickets first (FK), then booking. Trigger will release trip inventory.
  await admin.from("tickets").delete().eq("booking_id", id);
  const { error: deleteErr } = await admin.from("bookings").delete().eq("id", id);

  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Booking deleted. Trip seats released." });
}
