import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** POST: Issue warning, block, unblock, or clear warnings for a passenger. Admin or ticket_booth only. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin" && profile?.role !== "ticket_booth") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { profile_id?: string; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const profileId = typeof body.profile_id === "string" ? body.profile_id.trim() : null;
  const action = typeof body.action === "string" ? body.action.trim() : null;

  if (!profileId) return NextResponse.json({ error: "Missing profile_id" }, { status: 400 });
  const validActions = ["warn", "block", "unblock", "clear_warnings"] as const;
  if (!action || !validActions.includes(action as (typeof validActions)[number])) {
    return NextResponse.json({ error: "Missing or invalid action. Use: warn, block, unblock, clear_warnings" }, { status: 400 });
  }

  // Ensure target is a passenger (optional: don't allow restricting staff).
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("id", profileId)
    .maybeSingle();
  if (!targetProfile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (targetProfile.role !== "passenger") {
    return NextResponse.json({ error: "Restrictions apply only to passengers" }, { status: 400 });
  }

  const now = new Date().toISOString();

  if (action === "warn") {
    const { data: existing } = await supabase
      .from("passenger_booking_restrictions")
      .select("booking_warnings")
      .eq("profile_id", profileId)
      .maybeSingle();

    const currentWarnings = existing?.booking_warnings ?? 0;
    if (currentWarnings >= 2) {
      return NextResponse.json({ error: "Passenger already has 2 warnings. Use Block to prevent further bookings." }, { status: 400 });
    }
    const newWarnings = currentWarnings + 1;

    const { error: upsertErr } = await supabase
      .from("passenger_booking_restrictions")
      .upsert(
        {
          profile_id: profileId,
          booking_warnings: newWarnings,
          updated_at: now,
          updated_by: user.id,
        },
        { onConflict: "profile_id" }
      );
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      message: newWarnings === 1 ? "First warning issued." : "Second warning issued. Consider blocking if abuse continues.",
      booking_warnings: newWarnings,
    });
  }

  if (action === "block") {
    const { error: upsertErr } = await supabase
      .from("passenger_booking_restrictions")
      .upsert(
        {
          profile_id: profileId,
          booking_blocked_at: now,
          updated_at: now,
          updated_by: user.id,
        },
        { onConflict: "profile_id" }
      );
    if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Passenger blocked from making new bookings." });
  }

  if (action === "unblock") {
    const { error: updateErr } = await supabase
      .from("passenger_booking_restrictions")
      .update({ booking_blocked_at: null, updated_at: now, updated_by: user.id })
      .eq("profile_id", profileId);
    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, message: "Passenger unblocked. They can book again." });
  }

  // clear_warnings
  const { data: existing } = await supabase
    .from("passenger_booking_restrictions")
    .select("profile_id, booking_blocked_at")
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ ok: true, message: "No restrictions to clear.", booking_warnings: 0 });
  }
  const { error: updateErr } = await supabase
    .from("passenger_booking_restrictions")
    .update({ booking_warnings: 0, updated_at: now, updated_by: user.id })
    .eq("profile_id", profileId);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "Warnings cleared.", booking_warnings: 0 });
}
