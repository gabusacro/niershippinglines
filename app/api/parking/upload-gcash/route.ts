import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

const BUCKET        = "parking-docs";
const MAX_RAW_BYTES = 20 * 1024 * 1024; // 20 MB raw (client compresses before sending)
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png", "image/heic", "image/heif"];

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "You must be logged in." }, { status: 401 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }

  const proofFile = formData.get("gcash_proof") as File | null;
  const gcashRef  = formData.get("gcash_ref")   as string | null;

  if (!proofFile) return NextResponse.json({ error: "GCash screenshot is required." }, { status: 400 });
  if (proofFile.size > MAX_RAW_BYTES)
    return NextResponse.json({ error: "Screenshot too large (max 20 MB)." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(proofFile.type))
    return NextResponse.json({ error: "Screenshot must be an image (WebP, JPEG, PNG)." }, { status: 400 });

  const supabase = await createClient();
  const ext      = proofFile.name.split(".").pop() ?? "webp";
  const path     = `parking-docs/${user.id}/gcash_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, proofFile, { contentType: proofFile.type, upsert: false });

  if (uploadErr) {
    console.error("[upload-gcash] storage error:", uploadErr);
    return NextResponse.json({ error: "Failed to upload screenshot. Please try again." }, { status: 500 });
  }

  // Return the path + any ref so the reserve route can store them
  return NextResponse.json({ path, gcash_ref: gcashRef ?? null });
}

