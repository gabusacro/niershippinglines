import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_REASONS = ["weather_disturbance", "vessel_cancellation"] as const;

/** POST: Passenger requests a refund. Admin will review and process. Only weather/vessel cancellation per policy. */
export async function POST(request: NextRequest) {
  const { getAuthUser } = await import("@/lib/auth/get-user");
  const user = await getAuthUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { reference?: string; reason?: string; notes?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const reference = (body.reference ?? "").trim();
  const reason = (body.reason ?? "").trim();
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 500) : "";

  if (!reference) return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  if (!ALLOWED_REASONS.includes(reason as (typeof ALLOWED_REASONS)[number])) {
    return NextResponse.json(
      {
        error: "Refunds only for weather disturbance or vessel cancellation. Select a valid reason.",
        allowed_reasons: [...ALLOWED_REASONS],
      },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, customer_email, status, refund_requested_at")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  if ((booking.customer_email ?? "").toLowerCase() !== user.email!.toLowerCase()) {
    return NextResponse.json({ error: "You can only request refund for your own booking" }, { status: 403 });
  }
  if (booking.status === "refunded") {
    return NextResponse.json({ error: "This booking is already refunded" }, { status: 400 });
  }
  if (!["confirmed", "checked_in", "boarded", "pending_payment", "completed"].includes(booking.status)) {
    return NextResponse.json({ error: "Cannot request refund for this booking" }, { status: 400 });
  }
  if (booking.refund_requested_at) {
    return NextResponse.json({ error: "Refund already requested. We will process it soon." }, { status: 400 });
  }

  const updateClient = createAdminClient() ?? supabase;
  const { error: updateErr } = await updateClient
    .from("bookings")
    .update({
      refund_requested_at: new Date().toISOString(),
      refund_request_reason: reason,
      refund_request_notes: notes || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", booking.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    message: "Refund request submitted. We will review and process it. Check your booking page for status.",
  });
}
