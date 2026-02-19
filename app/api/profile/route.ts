import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

/** PATCH: Update current user's profile (e.g. full_name for display). */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { full_name?: string; salutation?: string; address?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const fullName = typeof body.full_name === "string" ? body.full_name.trim() || null : undefined;
  const salutation = typeof body.salutation === "string"
    ? (["Mr", "Mrs", "Ms"].includes(body.salutation) ? body.salutation : null)
    : undefined;
  const address = typeof body.address === "string" ? body.address.trim() || null : undefined;

  const updatedAt = new Date().toISOString();
  const updates: Record<string, unknown> = { updated_at: updatedAt };
  if (fullName !== undefined) updates.full_name = fullName;
  if (salutation !== undefined) updates.salutation = salutation;
  if (address !== undefined) updates.address = address;

  // Upsert: handles missing profile (e.g. OAuth/magic-link users) and ensures persistence
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        full_name: fullName ?? null,
        salutation: salutation ?? null,
        address: address ?? null,
        updated_at: updatedAt,
      },
      { onConflict: "id" }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sync profile name/salutation to auth.users user_metadata so we can identify users consistently
  if (fullName !== undefined || salutation !== undefined) {
    const meta = (user.user_metadata as Record<string, unknown>) ?? {};
    const newMeta: Record<string, unknown> = { ...meta };
    if (fullName !== undefined) newMeta.full_name = fullName ?? undefined;
    if (salutation !== undefined) newMeta.salutation = salutation ?? undefined;
    await supabase.auth.updateUser({ data: newMeta });
  }

  revalidatePath("/dashboard", "layout");
  return NextResponse.json({ ok: true, full_name: fullName ?? null, salutation: salutation ?? null, address: address ?? null });
}
