import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "payment-proofs";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

/** POST: Upload payment proof for a booking. Caller must own the booking; booking must be pending_payment. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const reference = formData.get("reference");
  const file = formData.get("file");
  if (!reference || typeof reference !== "string" || !file || !(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing reference or file. Send form fields: reference, file" },
      { status: 400 }
    );
  }

  const ref = reference.trim();
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, customer_email, status")
    .eq("reference", ref)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if ((booking.customer_email ?? "").toLowerCase().trim() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can only upload proof for your own booking" }, { status: 403 });
  }
  if (booking.status !== "pending_payment") {
    return NextResponse.json({ error: "This booking is not pending payment" }, { status: 400 });
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "Allowed types: image (JPEG, PNG, WebP, GIF) or PDF" },
      { status: 400 }
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext) ? ext : "jpg";
  const path = `${ref}/${Date.now()}-proof.${safeExt}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Use admin client: RLS only allows admin/crew to UPDATE bookings. We've verified
  // customer_email matches; admin client bypasses RLS for this authorized update.
  // Requires SUPABASE_SERVICE_ROLE_KEY. Fallback to supabase for created_by match (RLS policy).
  const updateClient = createAdminClient() ?? supabase;
  const { error: updateErr } = await updateClient
    .from("bookings")
    .update({ payment_proof_path: path, updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path });
}
