import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { NextRequest, NextResponse } from "next/server";

// POST — assign owner or crew to a lot
export async function POST(request: NextRequest) {
  const user = await getAuthUser();
  if (!user || (user.role as string) !== "admin")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { lot_id: string; action: "set_owner" | "add_crew" | "remove_crew"; user_id: string };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const { lot_id, action, user_id } = body;
  if (!lot_id || !action || !user_id)
    return NextResponse.json({ error: "lot_id, action and user_id are required." }, { status: 400 });

  const supabase = await createClient();

  if (action === "set_owner") {
    const { error } = await supabase
      .from("parking_lots")
      .update({ owner_id: user_id, updated_at: new Date().toISOString() })
      .eq("id", lot_id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === "add_crew") {
    // Upsert — if already assigned just reactivate
    const { data: existing } = await supabase
      .from("parking_lot_crew")
      .select("id, is_active")
      .eq("lot_id", lot_id)
      .eq("crew_id", user_id)
      .maybeSingle();

    if (existing) {
      await supabase.from("parking_lot_crew")
        .update({ is_active: true })
        .eq("id", existing.id);
    } else {
      await supabase.from("parking_lot_crew")
        .insert({ lot_id, crew_id: user_id, is_active: true, assigned_by: user.id });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "remove_crew") {
    await supabase.from("parking_lot_crew")
      .update({ is_active: false })
      .eq("lot_id", lot_id)
      .eq("crew_id", user_id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
