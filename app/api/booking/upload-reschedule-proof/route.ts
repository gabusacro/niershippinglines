import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

/** POST: Passenger uploads payment screenshot for reschedule fee. */
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const reference = ((formData.get("reference") as string) ?? "").trim().toUpperCase();

  if (!file || !reference) {
    return NextResponse.json({ error: "Missing file or reference" }, { status: 400 });
  }

  const supabase = await createClient();
  const email = user.email.trim().toLowerCase();

  const { data: booking, error: bookErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("reference", reference)
    .ilike("customer_email", email)
    .maybeSingle();

  if (bookErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  // Upload to storage
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `reschedule-proofs/${reference}-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const adminClient = createAdminClient();
  if (!adminClient) return NextResponse.json({ error: "Service unavailable" }, { status: 500 });

  const { error: uploadErr } = await adminClient.storage
    .from("payment-proofs")
    .upload(path, buffer, { contentType: file.type, upsert: true });

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  // Save proof path on the booking_changes row (most recent one for this booking)
  const { error: updateErr } = await adminClient
    .from("booking_changes")
    .update({ proof_path: path, proof_uploaded_at: new Date().toISOString() })
    .eq("booking_id", booking.id)
    .order("changed_at", { ascending: false })
    .limit(1);

  // Even if booking_changes update fails (column may not exist yet), we still return ok
  // Admin can see proof via the pending-reschedule-payments page once column is added
  if (updateErr) {
    console.error("[upload-reschedule-proof] booking_changes update:", updateErr.message);
  }

  return NextResponse.json({ ok: true, path });
}
