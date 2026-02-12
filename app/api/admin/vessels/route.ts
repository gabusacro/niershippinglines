import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** POST: Create a new vessel (boat). Admin only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: { name?: string; capacity?: number; online_quota?: number; image_url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  const capacity = typeof body.capacity === "number" && body.capacity > 0 ? body.capacity : 150;
  const onlineQuota = typeof body.online_quota === "number" && body.online_quota >= 0 ? body.online_quota : 100;
  const imageUrl = typeof body.image_url === "string" ? body.image_url.trim() || null : null;

  const insertPayload: { name: string; capacity: number; online_quota: number; status: string; image_url?: string | null } = {
    name,
    capacity,
    online_quota: onlineQuota,
    status: "running",
  };
  if (imageUrl !== undefined) insertPayload.image_url = imageUrl;

  const { data, error } = await supabase
    .from("boats")
    .insert(insertPayload)
    .select("id, name, capacity, online_quota, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
