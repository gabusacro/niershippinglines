import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

const BUCKET      = "parking-photos";
const MAX_PHOTOS  = 5;
const MAX_BYTES   = 15 * 1024 * 1024; // 15 MB (client compresses before sending)
const ALLOWED     = ["image/webp", "image/jpeg", "image/png"];

function toSeoSlug(s: string): string {
  return s.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

// GET — list photos for a lot (or all lots)
export async function GET(request: NextRequest) {
  const lotId = request.nextUrl.searchParams.get("lot_id");
  if (!lotId) return NextResponse.json({ error: "lot_id required." }, { status: 400 });

  const supabase = await createClient();

  let query = supabase
    .from("parking_lot_media")
    .select("id, lot_id, photo_url, seo_name, is_cover, sort_order, uploaded_at")
    .order("sort_order", { ascending: true });

  if (lotId !== "all") query = query.eq("lot_id", lotId);

  const { data } = await query;
  return NextResponse.json(data ?? []);
}

// POST — upload a new photo
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let formData: FormData;
  try { formData = await request.formData(); }
  catch { return NextResponse.json({ error: "Invalid form data." }, { status: 400 }); }

  const photo  = formData.get("photo")  as File   | null;
  const lotId  = formData.get("lot_id") as string | null;
  const lotName = formData.get("lot_name") as string | null;

  if (!photo)  return NextResponse.json({ error: "Photo required." },  { status: 400 });
  if (!lotId)  return NextResponse.json({ error: "lot_id required." }, { status: 400 });
  if (photo.size > MAX_BYTES)
    return NextResponse.json({ error: `Photo too large (max ${MAX_BYTES / 1024 / 1024} MB).` }, { status: 400 });
  if (!ALLOWED.includes(photo.type))
    return NextResponse.json({ error: "Must be WebP, JPEG or PNG." }, { status: 400 });

  const supabase = await createClient();

  // Check max photos
  const { count } = await supabase
    .from("parking_lot_media")
    .select("id", { count: "exact", head: true })
    .eq("lot_id", lotId);

  if ((count ?? 0) >= MAX_PHOTOS)
    return NextResponse.json({ error: `Maximum ${MAX_PHOTOS} photos per lot. Delete one first.` }, { status: 409 });

  // SEO filename: travela-parking-port-area-1-photo-1748291234567.webp
  const baseSlug  = lotName ? toSeoSlug(lotName) : `lot-${lotId.slice(0, 8)}`;
  const seoName   = `${baseSlug}-photo-${Date.now()}`;
  const path      = `lot-photos/${lotId}/${seoName}.webp`;

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, photo, { contentType: "image/webp", upsert: false });

  if (uploadErr)
    return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

  // If this is the first photo, make it the cover
  const isFirstPhoto = (count ?? 0) === 0;

  const { data: media, error: insertErr } = await supabase
    .from("parking_lot_media")
    .insert({
      lot_id:      lotId,
      photo_path:  path,
      photo_url:   publicUrl,
      seo_name:    seoName,
      is_cover:    isFirstPhoto,
      sort_order:  count ?? 0,
      uploaded_by: user.id,
    })
    .select("id, photo_url, seo_name, is_cover, sort_order")
    .single();

  if (insertErr) {
    // Clean up orphan
    await supabase.storage.from(BUCKET).remove([path]);
    return NextResponse.json({ error: "Failed to save photo record." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, photo: media });
}

// DELETE — remove a photo
export async function DELETE(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const photoId = request.nextUrl.searchParams.get("id");
  if (!photoId) return NextResponse.json({ error: "id required." }, { status: 400 });

  const supabase = await createClient();

  const { data: photo } = await supabase
    .from("parking_lot_media")
    .select("id, photo_path, is_cover, lot_id")
    .eq("id", photoId)
    .maybeSingle();

  if (!photo) return NextResponse.json({ error: "Photo not found." }, { status: 404 });

  // Delete from storage
  await supabase.storage.from(BUCKET).remove([photo.photo_path]);

  // Delete record
  await supabase.from("parking_lot_media").delete().eq("id", photoId);

  // If deleted photo was cover, promote next photo to cover
  if (photo.is_cover) {
    const { data: next } = await supabase
      .from("parking_lot_media")
      .select("id")
      .eq("lot_id", photo.lot_id)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabase.from("parking_lot_media").update({ is_cover: true }).eq("id", next.id);
    }
  }

  return NextResponse.json({ ok: true });
}

// PATCH — set cover photo
export async function PATCH(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id: string; lot_id: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const supabase = await createClient();

  // Remove cover from all photos in this lot
  await supabase.from("parking_lot_media")
    .update({ is_cover: false })
    .eq("lot_id", body.lot_id);

  // Set new cover
  await supabase.from("parking_lot_media")
    .update({ is_cover: true })
    .eq("id", body.id);

  return NextResponse.json({ ok: true });
}
