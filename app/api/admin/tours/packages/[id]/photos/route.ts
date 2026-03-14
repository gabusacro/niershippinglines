import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || !["admin", "tour_operator"].includes(user.role ?? "")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const supabase = await createClient();

  // Verify ownership
  const { data: pkg } = await supabase
    .from("tour_packages")
    .select("id, owner_type, owner_id")
    .eq("id", id)
    .single();

  if (!pkg) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Operators can only update their own packages
  if (user.role === "tour_operator" &&
    (pkg.owner_type !== "operator" || pkg.owner_id !== user.id)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("cover_image_url" in body) update.cover_image_url = body.cover_image_url;
  if ("gallery_urls" in body) update.gallery_urls = body.gallery_urls;

  const { error } = await supabase
    .from("tour_packages")
    .update(update)
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
