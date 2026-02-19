import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** POST: Mark ticket as checked_in or boarded. Crew/ticket_booth/admin/captain only.
 *
 *  Body (ticket-level — preferred):
 *    { ticket_number: "HMGT89BP8E", action: "checked_in" | "boarded" }
 *
 *  Body (legacy booking-level fallback — used by manifest buttons):
 *    { reference: "883Z3LTDJE", action: "checked_in" | "boarded" }
 *
 *  When ticket_number is provided, only THAT passenger's ticket row is updated.
 *  The booking status is also updated to the highest status across all its tickets.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(profile?.role ?? "");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    reference?: string;
    ticket_number?: string;
    passenger_index?: number;
    action?: "checked_in" | "boarded";
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const action = body.action === "checked_in" || body.action === "boarded" ? body.action : "checked_in";
  const now = new Date().toISOString();

  // ── Per-ticket update (ticket_number provided — from QR scanner) ──────────
  const ticketNumber = typeof body.ticket_number === "string" ? body.ticket_number.trim() : "";

  if (ticketNumber) {
    // Look up the ticket row — use ticket_number as the key (no id column)
    const { data: ticket, error: ticketErr } = await supabase
      .from("tickets")
      .select("ticket_number, booking_id, status, checked_in_at, boarded_at")
      .eq("ticket_number", ticketNumber)
      .maybeSingle();

    if (ticketErr || !ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const validStatuses = ["confirmed", "checked_in", "boarded"];
    if (!validStatuses.includes(ticket.status ?? "")) {
      return NextResponse.json({ error: `Cannot update: ticket status is ${ticket.status}` }, { status: 400 });
    }

    // Build ticket-level updates
    const ticketUpdates: Record<string, string> = { status: action };
    if (action === "checked_in" && !ticket.checked_in_at) {
      ticketUpdates.checked_in_at = now;
    }
    if (action === "boarded") {
      ticketUpdates.boarded_at = now;
      if (!ticket.checked_in_at) ticketUpdates.checked_in_at = now;
    }

    // Update using ticket_number as the key instead of id
    const { error: ticketUpdateErr } = await supabase
      .from("tickets")
      .update(ticketUpdates)
      .eq("ticket_number", ticketNumber);

    if (ticketUpdateErr) {
      return NextResponse.json({ error: ticketUpdateErr.message }, { status: 500 });
    }

    // Update booking status to reflect the HIGHEST status across all its tickets
    const { data: siblingTickets } = await supabase
      .from("tickets")
      .select("status")
      .eq("booking_id", ticket.booking_id);

    const allStatuses = (siblingTickets ?? []).map((t: { status: string }) => t.status);
    let bookingStatus = "confirmed";
    if (allStatuses.some((s) => s === "boarded")) bookingStatus = "boarded";
    else if (allStatuses.some((s) => s === "checked_in")) bookingStatus = "checked_in";

    const bookingUpdates: Record<string, string> = { status: bookingStatus };
    if (bookingStatus === "checked_in" || bookingStatus === "boarded") {
      bookingUpdates.checked_in_at = now;
    }
    if (bookingStatus === "boarded") {
      bookingUpdates.boarded_at = now;
    }

    await supabase
      .from("bookings")
      .update(bookingUpdates)
      .eq("id", ticket.booking_id);

    return NextResponse.json({ ok: true, status: action });
  }

  // ── Legacy booking-level update (reference provided — from manifest buttons) ─
  const reference = typeof body.reference === "string" ? body.reference.trim().toUpperCase() : "";
  if (!reference) {
    return NextResponse.json({ error: "Missing ticket_number or reference" }, { status: 400 });
  }

  const { data: booking, error: fetchErr } = await supabase
    .from("bookings")
    .select("id, status")
    .eq("reference", reference)
    .maybeSingle();

  if (fetchErr || !booking) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const validStatuses = ["confirmed", "checked_in", "boarded"];
  if (!validStatuses.includes(booking.status ?? "")) {
    return NextResponse.json({ error: `Cannot check in: status is ${booking.status}` }, { status: 400 });
  }

  const updates: Record<string, string> = { status: action };
  if (action === "checked_in") {
    updates.checked_in_at = now;
  } else {
    updates.boarded_at = now;
    updates.checked_in_at = now;
  }

  const { error: updateErr } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", booking.id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Also update all tickets under this booking to match
  await supabase
    .from("tickets")
    .update(updates)
    .eq("booking_id", booking.id);

  return NextResponse.json({ ok: true, status: action });
}
