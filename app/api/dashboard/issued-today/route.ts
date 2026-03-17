import { createClient } from "@/lib/supabase/server";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTodayInManila } from "@/lib/admin/ph-time";
import { NextResponse } from "next/server";

/**
 * GET /api/dashboard/issued-today
 *
 * Returns all bookings created by the current ticket-booth user today (Manila time).
 * Used by TicketBoothDashboard to refresh the "Tickets Issued Today" list after
 * issuing a new ticket — without a full page reload.
 *
 * Only accessible by ticket_booth and admin roles.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allowed = ["admin", "ticket_booth"];
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();
  const todayManila = getTodayInManila();

  // Build a Manila-midnight range so we only get today's bookings
  // regardless of the server's timezone
  const startOfDay = `${todayManila}T00:00:00+08:00`;
  const endOfDay   = `${todayManila}T23:59:59+08:00`;

  const query = supabase
    .from("bookings")
    .select("reference, customer_full_name, total_amount_cents, passenger_count, created_at, trip_id")
    .eq("is_walk_in", true)
    .gte("created_at", startOfDay)
    .lte("created_at", endOfDay)
    .order("created_at", { ascending: false });

  // Ticket booth staff only see their own bookings; admins see all
  if (user.role === "ticket_booth") {
    query.eq("created_by", user.id);
  }

  const { data, error } = await query;

  if (error) {
    console.error("[issued-today] query error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
