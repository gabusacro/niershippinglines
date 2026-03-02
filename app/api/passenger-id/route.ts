import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "passenger-ids";
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const DISCOUNT_TYPES = ["senior", "pwd", "student", "child"] as const;
type DiscountType = typeof DISCOUNT_TYPES[number];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data" }, { status: 400 }); }

  const bookingReference = formData.get("booking_reference");
  const passengerIndexRaw = formData.get("passenger_index");
  const passengerName = formData.get("passenger_name");
  const ticketNumber = formData.get("ticket_number") ?? "";
  const discountType = formData.get("discount_type") as DiscountType | null;
  const file = formData.get("file");

  if (!bookingReference || typeof bookingReference !== "string" || passengerIndexRaw === null ||
    !file || !(file instanceof File) || !discountType || !DISCOUNT_TYPES.includes(discountType)) {
    return NextResponse.json({ error: "Missing fields: booking_reference, passenger_index, discount_type, file" }, { status: 400 });
  }
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
  if (!ALLOWED_TYPES.includes(file.type)) return NextResponse.json({ error: "Allowed types: JPEG, PNG, WebP, GIF, or PDF" }, { status: 400 });

  const ref = bookingReference.trim().toUpperCase();
  const idx = parseInt(String(passengerIndexRaw), 10);
  const adminClient = createAdminClient() ?? supabase;

  // Look up booking — removed email ownership check.
  // Passengers often book for family members using a different email,
  // so restricting by email blocks legitimate uploads.
  const { data: booking, error: fetchErr } = await adminClient
    .from("bookings")
    .select("id, customer_email, status")
    .eq("reference", ref)
    .maybeSingle();
  if (fetchErr || !booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

  // ── Check if this profile already has a valid verified ID for this discount type ──
  // If yes, reuse it — no need to upload again
  const { data: existingVerified } = await adminClient
    .from("passenger_id_verifications")
    .select("id, id_image_url, expires_at")
    .eq("profile_id", user.id)
    .eq("discount_type", discountType)
    .eq("verification_status", "verified")
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const isStillValid = existingVerified?.expires_at
    ? new Date(existingVerified.expires_at) > new Date()
    : false;

  if (existingVerified && isStillValid) {
    // Link existing verified ID to this booking
    const { data: linked, error: linkErr } = await adminClient
      .from("passenger_id_verifications")
      .insert({
        booking_id: booking.id,
        profile_id: user.id,
        ticket_number: typeof ticketNumber === "string" ? ticketNumber.trim() || null : null,
        passenger_index: idx,
        passenger_name: typeof passengerName === "string" ? passengerName.trim() : "",
        discount_type: discountType,
        id_image_path: null,
        id_image_url: existingVerified.id_image_url,
        uploaded_by: user.id,
        verification_status: "verified",
        expires_at: existingVerified.expires_at,
      })
      .select("id")
      .single();
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: linked?.id, reused: true, message: "Your previously verified ID has been linked to this booking." });
  }

  // ── No existing verified ID — upload new file ──
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg","jpeg","png","webp","gif","pdf"].includes(ext) ? ext : "jpg";
  const path = `${ref}/pax-${idx}-${discountType}-${Date.now()}.${safeExt}`;

  const { error: uploadErr } = await adminClient.storage
    .from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 });

  const { data: signedData } = await adminClient.storage
    .from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 365);
  const idImageUrl = signedData?.signedUrl ?? null;

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 1);

  const { data: inserted, error: insertErr } = await adminClient
    .from("passenger_id_verifications")
    .insert({
      booking_id: booking.id,
      profile_id: user.id,
      ticket_number: typeof ticketNumber === "string" ? ticketNumber.trim() || null : null,
      passenger_index: idx,
      passenger_name: typeof passengerName === "string" ? passengerName.trim() : "",
      discount_type: discountType,
      id_image_path: path,
      id_image_url: idImageUrl,
      uploaded_by: user.id,
      verification_status: "pending",
      expires_at: expiresAt.toISOString(),
    })
    .select("id").single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: inserted?.id, path, url: idImageUrl });
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bookingRef = request.nextUrl.searchParams.get("booking_reference");
  let query = supabase
    .from("passenger_id_verifications")
    .select("id, discount_type, passenger_name, verification_status, expires_at, renewal_requested_at, id_image_url, uploaded_at, admin_note")
    .eq("profile_id", user.id)
    .order("uploaded_at", { ascending: false });

  if (bookingRef) {
    const { data: bk } = await supabase.from("bookings").select("id").eq("reference", bookingRef.toUpperCase()).maybeSingle();
    if (bk) query = query.eq("booking_id", bk.id) as typeof query;
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ verifications: data ?? [] });
}
