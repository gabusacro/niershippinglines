import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextRequest, NextResponse } from "next/server";

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401, supabase, user: null };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin","ticket_booth"].includes(profile?.role ?? ""))
    return { error: "Forbidden", status: 403, supabase, user: null };
  return { error: null, status: 200, supabase, user };
}

/** GET: List all ID verifications with profile + booking info */
export async function GET(request: NextRequest) {
  const { error, status, supabase } = await requireAdmin();
  if (error) return NextResponse.json({ error }, { status });

  const adminClient = createAdminClient() ?? supabase;
  const statusFilter = request.nextUrl.searchParams.get("status");

  // Step 1: fetch all ID verification rows — no joins, no risk of silent empty result
  let query = adminClient
    .from("passenger_id_verifications")
    .select("id, passenger_name, discount_type, verification_status, id_image_url, uploaded_at, expires_at, renewal_requested_at, renewal_notified_at, admin_note, rejection_reason, profile_id, booking_id, uploaded_by")
    .order("uploaded_at", { ascending: false });

  if (statusFilter) {
    query = query.eq("verification_status", statusFilter) as typeof query;
  }

  const { data: rows, error: fetchError } = await query;
  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
  if (!rows || rows.length === 0) return NextResponse.json({ records: [] });

  // Step 2: collect unique booking_ids and uploaded_by ids for batch lookups
  const bookingIds  = [...new Set(rows.map((r: { booking_id: string | null }) => r.booking_id).filter(Boolean))] as string[];
  const uploaderIds = [...new Set(rows.map((r: { uploaded_by: string | null }) => r.uploaded_by).filter(Boolean))] as string[];

  // Step 3: batch fetch bookings references
  const bookingRefMap = new Map<string, string>();
  if (bookingIds.length > 0) {
    const { data: bookings } = await adminClient
      .from("bookings")
      .select("id, reference")
      .in("id", bookingIds);
    for (const b of bookings ?? []) bookingRefMap.set(b.id, b.reference ?? "");
  }

  // Step 4: batch fetch uploader emails
  const uploaderEmailMap = new Map<string, string>();
  if (uploaderIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, email, full_name")
      .in("id", uploaderIds);
    for (const p of profiles ?? []) uploaderEmailMap.set(p.id, p.email ?? "");
  }

  // Step 5: assemble final records
  const records = rows.map((r: {
    id: string;
    passenger_name: string;
    discount_type: string;
    verification_status: string;
    id_image_url: string | null;
    uploaded_at: string | null;
    expires_at: string | null;
    renewal_requested_at: string | null;
    renewal_notified_at: string | null;
    admin_note: string | null;
    rejection_reason: string | null;
    profile_id: string | null;
    booking_id: string | null;
    uploaded_by: string | null;
  }) => ({
    id: r.id,
    passenger_name: r.passenger_name,
    discount_type: r.discount_type,
    verification_status: r.verification_status,
    id_image_url: r.id_image_url,
    uploaded_at: r.uploaded_at,
    expires_at: r.expires_at,
    renewal_requested_at: r.renewal_requested_at,
    renewal_notified_at: r.renewal_notified_at,
    admin_note: r.admin_note,
    rejection_reason: r.rejection_reason,
    profile_id: r.profile_id,
    booking_reference: r.booking_id ? (bookingRefMap.get(r.booking_id) ?? null) : null,
    profile_email: r.uploaded_by ? (uploaderEmailMap.get(r.uploaded_by) ?? null) : null,
  }));

  return NextResponse.json({ records });
}

/** PATCH: Verify, reject, or request renewal of an ID */
export async function PATCH(request: NextRequest) {
  const { error, status, supabase, user } = await requireAdmin();
  if (error || !user) return NextResponse.json({ error }, { status });

  const adminClient = createAdminClient() ?? supabase;

  let body: {
    id?: string;
    action?: string;
    admin_note?: string | null;
    rejection_reason?: string | null;
    renewal_message?: string | null;
    profile_id?: string | null;
  };
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { id, action, admin_note, rejection_reason, renewal_message, profile_id } = body;
  if (!id || !action) return NextResponse.json({ error: "Missing id or action" }, { status: 400 });

  const now = new Date().toISOString();

  if (action === "verify") {
    // Set verified, set expiry 1 year from now
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);

    const { error: upErr } = await adminClient
      .from("passenger_id_verifications")
      .update({
        verification_status: "verified",
        verified_by: user.id,
        verified_at: now,
        admin_note: admin_note ?? null,
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Notify passenger
    if (profile_id) {
      await adminClient.from("notifications").insert({
        profile_id,
        type: "id_approved",
        title: "✓ Discount ID Verified",
        message: "Your discount ID has been verified. Your discount will be applied on your next booking.",
        action_url: "/account",
      });
    }
    return NextResponse.json({ ok: true, action: "verified" });
  }

  if (action === "reject") {
    const reason = rejection_reason || "Please resubmit a clear, valid ID photo.";
    const { error: upErr } = await adminClient
      .from("passenger_id_verifications")
      .update({
        verification_status: "rejected",
        verified_by: user.id,
        verified_at: now,
        rejection_reason: reason,
        admin_note: admin_note ?? null,
      })
      .eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Notify passenger
    if (profile_id) {
      await adminClient.from("notifications").insert({
        profile_id,
        type: "id_rejected",
        title: "⚠ Discount ID Rejected",
        message: `Your discount ID was rejected. Reason: ${reason}. Please upload a new valid ID.`,
        action_url: "/account",
      });
    }
    return NextResponse.json({ ok: true, action: "rejected" });
  }

  if (action === "request_renewal") {
    const msg = renewal_message || "Your discount ID is expiring soon. Please upload a new one to continue receiving your discount.";
    const { error: upErr } = await adminClient
      .from("passenger_id_verifications")
      .update({
        renewal_requested_at: now,
        renewal_notified_at: now,
        admin_note: admin_note ?? null,
      })
      .eq("id", id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    // Notify passenger
    if (profile_id) {
      await adminClient.from("notifications").insert({
        profile_id,
        type: "id_renewal_required",
        title: "🔄 ID Renewal Required",
        message: msg,
        action_url: "/account",
      });
    }
    return NextResponse.json({ ok: true, action: "renewal_requested" });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
