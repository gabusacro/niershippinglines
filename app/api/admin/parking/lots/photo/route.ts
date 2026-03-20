import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

const BUCKET = "parking-photos";
const ALLOWED_TYPES = ["image/webp", "image/jpeg", "image/png"];
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }

  const photo  = formData.get("photo")  as File   | null;
  const lot_id = formData.get("lot_id") as string | null;

  if (!photo)  return NextResponse.json({ error: "Photo required." },  { status: 400 });
  if (!lot_id) return NextResponse.json({ error: "lot_id required." }, { status: 400 });
  if (photo.size > MAX_BYTES)
    return NextResponse.json({ error: "Photo too large (max 10 MB)." }, { status: 400 });
  if (!ALLOWED_TYPES.includes(photo.type))
    return NextResponse.json({ error: "Must be WebP, JPEG or PNG." }, { status: 400 });

  const supabase = await createClient();
  const ext  = photo.name.split(".").pop() ?? "webp";
  const path = `lot-photos/${lot_id}/cover_${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, photo, { contentType: photo.type, upsert: true });

  if (uploadErr)
    return NextResponse.json({ error: "Upload failed." }, { status: 500 });

  // Get public URL
  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // Save to parking_lots
  await supabase.from("parking_lots")
    .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
    .eq("id", lot_id);

  return NextResponse.json({ ok: true, image_url: publicUrl });
}
