import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

const SELECT_FIELDS = "id, full_name, gender, birthdate, nationality, address, phone, fare_type, id_verified, id_verified_at, id_expires_at";

// PATCH: update a saved traveler
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body?.full_name?.trim()) {
    return NextResponse.json({ error: "full_name is required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_travelers")
    .update({
      full_name:   body.full_name.trim(),
      gender:      body.gender      || null,
      birthdate:   body.birthdate   || null,
      nationality: body.nationality || null,
      address:     body.address     || null,
      phone:       body.phone       || null,
    })
    .eq("id", id)
    .eq("profile_id", user.id)
    .select(SELECT_FIELDS)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ traveler: data });
}

// DELETE: remove a saved traveler
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("saved_travelers")
    .delete()
    .eq("id", id)
    .eq("profile_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
