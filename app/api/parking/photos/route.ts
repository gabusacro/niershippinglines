import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "parking-photos";
const ALLOWED_LABELS = ["arrival", "departure", "damage", "other"];
const ALLOWED_TYPES  = ["image/webp", "image/jpeg", "image/png", "image/heic", "image/heif"];
const MAX_BYTES      = 20 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only staff can upload condition photos
  const allowedRoles = ["admin", "parking_owner", "parking_crew"];
  if (!allowedRoles.includes(user.role as string))
    return NextResponse.json({ error: "Only parking staff can upload condition photos." }, { status: 403 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }

  const photo          = formData.get("photo")          as File   | null;
  const reservationId  = formData.get("reservation_id") as string | null;
  const vehiclePlate   = formData.get("vehicle_plate")  as string | null;
  const label          = formData.get("label")          as string | null;
  const notes          = formData.get("notes")          as string | null;

  if (!photo)         return NextResponse.json({ error: "Photo is required." },          { status: 400 });
  if (!reservationId) return NextResponse.json({ error: "Reservation ID is required." }, { status: 400 });
  if (!vehiclePlate)  return NextResponse.json({ error: "Vehicle plate is required." },  { status: 400 });
  if (!label || !ALLOWED_LABELS.includes(label))
    return NextResponse.json({ error: `Label must be one of: ${ALLOWED_LABELS.join(", ")}.` }, { status: 400 });
  if (photo.size > MAX_BYTES)
    return NextResponse.json({ error: "Photo too large (max 20 MB)." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(photo.type))
    return NextResponse.json({ error: "Photo must be an image (WebP, JPEG, PNG)." }, { status: 400 });

  const supabase = await createClient();

  // Verify reservation exists and staff has access
  const { data: reservation } = await supabase
    .from("parking_reservations")
    .select("id, lot_id, status")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation)
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  // Crew must be assigned to this lot
  if ((user.role as string) === "parking_crew") {
    const { data: crewAssign } = await supabase
      .from("parking_lot_crew")
      .select("id")
      .eq("lot_id", reservation.lot_id)
      .eq("crew_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!crewAssign)
      return NextResponse.json({ error: "You are not assigned to this parking lot." }, { status: 403 });
  }

  // Owner must own this lot
  if ((user.role as string) === "parking_owner") {
    const { data: lotOwner } = await supabase
      .from("parking_lots")
      .select("id")
      .eq("id", reservation.lot_id)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!lotOwner)
      return NextResponse.json({ error: "You do not own this parking lot." }, { status: 403 });
  }

  // Build storage path
  const plate    = vehiclePlate.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const ext      = photo.name.split(".").pop() ?? "webp";
  const path     = `parking-photos/${reservationId}/${plate}_${label}_${Date.now()}.${ext}`;
  const expiresAt = new Date(Date.now() + 6 * 30 * 24 * 60 * 60 * 1000).toISOString(); // ~6 months

  // Upload to storage
  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, photo, { contentType: photo.type, upsert: false });

  if (uploadErr) {
    console.error("[parking/photos] upload error:", uploadErr);
    return NextResponse.json({ error: "Failed to upload photo. Please try again." }, { status: 500 });
  }

  // Insert record
  const { data: photoRecord, error: insertErr } = await supabase
    .from("parking_vehicle_photos")
    .insert({
      reservation_id: reservationId,
      vehicle_plate:  vehiclePlate.toUpperCase(),
      label,
      photo_path:     path,
      notes:          notes?.trim() || null,
      uploaded_by:    user.id,
      expires_at:     expiresAt,
    })
    .select("id, photo_path, label, notes, uploaded_at")
    .single();

  if (insertErr) {
    console.error("[parking/photos] insert error:", insertErr);
    // Clean up orphan storage file
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Failed to save photo record." }, { status: 500 });
  }

  // Log it on the reservation
  await supabase.from("parking_reservation_logs").insert({
    reservation_id: reservationId,
    event_type:     "photo_uploaded",
    performed_by:   user.id,
    notes:          `${label} photo uploaded for ${vehiclePlate.toUpperCase()}.${notes ? ` Note: ${notes}` : ""}`,
    metadata:       { photo_id: photoRecord.id, photo_path: path, label, vehicle_plate: vehiclePlate },
  });

  return NextResponse.json({ ok: true, photo: photoRecord });
}

// GET — fetch all photos for a reservation
export async function GET(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reservationId = request.nextUrl.searchParams.get("reservation_id");
  if (!reservationId) return NextResponse.json({ error: "reservation_id required." }, { status: 400 });

  const supabase = await createClient();

  // Verify access — customer can only see their own reservation's photos
  const { data: reservation } = await supabase
    .from("parking_reservations")
    .select("id, customer_profile_id, lot_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (!reservation) return NextResponse.json({ error: "Reservation not found." }, { status: 404 });

  const isStaff    = ["admin", "parking_owner", "parking_crew"].includes(user.role);
  const isCustomer = reservation.customer_profile_id === user.id;
  if (!isStaff && !isCustomer)
    return NextResponse.json({ error: "Access denied." }, { status: 403 });

  const { data: photos } = await supabase
    .from("parking_vehicle_photos")
    .select("id, vehicle_plate, label, photo_path, notes, uploaded_at, uploaded_by, expires_at, uploader:profiles!uploaded_by(full_name, role)")
    .eq("reservation_id", reservationId)
    .gt("expires_at", new Date().toISOString())  // exclude expired
    .order("uploaded_at", { ascending: true });

  // Generate signed URLs for each photo (1 hour expiry for viewing)
  const photosWithUrls = await Promise.all(
    (photos ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(p.photo_path, 3600);
      return { ...p, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json(photosWithUrls);
}
