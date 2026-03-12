import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  if (!formData) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });

  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  // Validate type
  const allowed = ["image/jpeg", "image/png", "image/webp"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: "Only JPEG, PNG or WebP images are allowed" }, { status: 400 });
  }

  // Validate size (5MB max — client compresses but just in case)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
  }

  const ext = file.type === "image/webp" ? "webp" : file.type === "image/png" ? "png" : "jpg";
  const path = `${user.id}/avatar.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Upload to Supabase Storage (upsert = overwrite existing)
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  // Add cache-busting timestamp to URL
  const avatarUrl = `${publicUrl}?t=${Date.now()}`;

  // Save URL to profile
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({ id: user.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: "id" });

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  // Also update auth metadata
  await supabase.auth.updateUser({ data: { avatar_url: avatarUrl } });

  revalidatePath("/account", "layout");
  revalidatePath("/dashboard", "layout");

  return NextResponse.json({ avatar_url: avatarUrl });
}
