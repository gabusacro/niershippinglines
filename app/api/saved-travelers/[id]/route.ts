import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

// PATCH: update a saved traveler
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body?.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_travelers")
    .update({
      full_name: body.full_name.trim(),
      gender: body.gender || null,
      birthdate: body.birthdate || null,
      nationality: body.nationality || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("profile_id", user.id) // ensure ownership
    .select("id, full_name, gender, birthdate, nationality")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ traveler: data });
}

// DELETE: remove a saved traveler
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { error } = await supabase
    .from("saved_travelers")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id); // ensure ownership

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
