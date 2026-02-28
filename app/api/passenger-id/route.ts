import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "passenger-ids";
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

/**
 * POST: Upload a Senior Citizen / PWD ID for a passenger.
 * Body (multipart/form-data):
 *   - booking_reference: string
 *   - passenger_index: number (0-based)
 *   - passenger_name: string
 *   - ticket_number: string (optional, can be empty before booking confirms)
 *   - discount_type: "senior" | "pwd"
 *   - file: File
 */
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

  const bookingReference = formData.get("booking_reference");
  const passengerIndex = formData.get("passenger_index");
  const passengerName = formData.get("passenger_name");
  const ticketNumber = formData.get("ticket_number") ?? "";
  const discountType = formData.get("discount_type");
  const file = formData.get("file");

  if (
    !bookingReference || typeof bookingReference !== "string" ||
    passengerIndex === null || !file || !(file instanceof File) ||
    !discountType || !["senior", "pwd"].includes(discountType as string)
  ) {
    return NextResponse.json(
      { error: "Missing fields: booking_reference, passenger_index, discount_type, file" },
      { status: 400 }
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "Allowed types: JPEG, PNG, WebP, GIF, or PDF" }, { status: 400 });
  }

  const ref = bookingReference.trim();

  // Verify the booking belongs to this user
  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, customer_email, status")
    .eq("reference", ref)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }
  if ((booking.customer_email ?? "").toLowerCase().trim() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "You can only upload IDs for your own booking" }, { status: 403 });
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif", "pdf"].includes(ext) ? ext : "jpg";
  const idx = parseInt(String(passengerIndex), 10);
  const path = `${ref}/pax-${idx}-${discountType}-${Date.now()}.${safeExt}`;

  const adminClient = createAdminClient() ?? supabase;

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Get public URL
  const { data: urlData } = adminClient.storage.from(BUCKET).getPublicUrl(path);
  const publicUrl = urlData?.publicUrl ?? null;

  // Insert into passenger_id_verifications
  const { error: insertErr } = await adminClient
    .from("passenger_id_verifications")
    .insert({
      booking_id: booking.id,
      ticket_number: typeof ticketNumber === "string" ? ticketNumber.trim() || null : null,
      passenger_index: idx,
      passenger_name: typeof passengerName === "string" ? passengerName.trim() : "",
      discount_type: discountType,
      id_image_path: path,
      id_image_url: publicUrl,
      uploaded_by: user.id,
      verification_status: "pending",
    });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, path, url: publicUrl });
}
