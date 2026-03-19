import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "parking-docs";
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png", "image/heic", "image/heif"];

export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "You must be logged in to upload documents." }, { status: 401 });
  }

  // ── Parse multipart form ──────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const orCrFile    = formData.get("or_cr")     as File | null;
  const idPhotoFile = formData.get("id_photo")  as File | null;
  const plateRaw    = formData.get("plate_number") as string | null;
  const vehicleIdx  = formData.get("vehicle_index") as string | null;

  if (!orCrFile || !idPhotoFile) {
    return NextResponse.json({ error: "Both or_cr and id_photo files are required." }, { status: 400 });
  }

  // ── Validate files ────────────────────────────────────────────────────────
  for (const [label, file] of [["OR/CR", orCrFile], ["ID photo", idPhotoFile]] as [string, File][]) {
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: `${label} exceeds 5 MB limit.` }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `${label} must be an image (WebP, JPEG, PNG, HEIC).` }, { status: 400 });
    }
  }

  // ── Build storage paths ───────────────────────────────────────────────────
  // Structure: parking-docs/{user_id}/{timestamp}_{plate}_{idx}_{type}.webp
  const ts    = Date.now();
  const plate = (plateRaw ?? "unknown").replace(/[^A-Z0-9]/gi, "").toUpperCase();
  const idx   = vehicleIdx ?? "0";
  const base  = `parking-docs/${user.id}/${ts}_${plate}_v${idx}`;

  const orCrExt    = orCrFile.name.split(".").pop()    ?? "webp";
  const idPhotoExt = idPhotoFile.name.split(".").pop() ?? "webp";

  const orCrPath    = `${base}_orcr.${orCrExt}`;
  const idPhotoPath = `${base}_id.${idPhotoExt}`;

  // ── Upload to Supabase Storage ────────────────────────────────────────────
  const supabase = await createClient();

  const [orCrUpload, idPhotoUpload] = await Promise.all([
    supabase.storage
      .from(BUCKET)
      .upload(orCrPath, orCrFile, {
        contentType: orCrFile.type,
        upsert: false,
      }),
    supabase.storage
      .from(BUCKET)
      .upload(idPhotoPath, idPhotoFile, {
        contentType: idPhotoFile.type,
        upsert: false,
      }),
  ]);

  if (orCrUpload.error) {
    console.error("[upload-docs] or_cr upload error:", orCrUpload.error);
    return NextResponse.json(
      { error: "Failed to upload OR/CR photo. Please try again." },
      { status: 500 }
    );
  }
  if (idPhotoUpload.error) {
    console.error("[upload-docs] id_photo upload error:", idPhotoUpload.error);
    // Clean up the successful OR/CR upload so we don't leave orphans
    await supabase.storage.from(BUCKET).remove([orCrPath]);
    return NextResponse.json(
      { error: "Failed to upload ID photo. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    or_cr_path:    orCrUpload.data.path,
    id_photo_path: idPhotoUpload.data.path,
  });
}
