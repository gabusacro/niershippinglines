import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

/** GET: Validate ticket from QR scan. Crew/ticket_booth/admin only. Payload format: NIER:reference:passengerIndex */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(role ?? "");
  if (!allowed) return NextResponse.json({ error: "Forbidden: crew access required" }, { status: 403 });

  const payload = request.nextUrl.searchParams.get("payload") ?? "";
  const match = payload.match(/^NIER:([A-Z0-9]+):(\d+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Invalid QR format. Scan a valid ticket." }, { status: 400 });
  }
  const [, reference, idxStr] = match;
  const passengerIndex = parseInt(idxStr ?? "0", 10);

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, customer_full_name, customer_email, passenger_count, status, passenger_details, trip:trips!bookings_trip_id_fkey(departure_date, departure_time, boat:boats(name), route:routes(display_name))"
    )
    .eq("reference", reference.toUpperCase())
    .maybeSingle();

  if (error || !booking) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  const validStatuses = ["confirmed", "checked_in", "boarded", "completed"];
  if (!validStatuses.includes(booking.status ?? "")) {
    return NextResponse.json({
      error: `Ticket status: ${booking.status}. Not valid for boarding.`,
      booking: { reference: booking.reference, status: booking.status },
    }, { status: 400 });
  }

  const details = booking.passenger_details as { full_name?: string }[] | null;
  const passengers = Array.isArray(details) && details.length > 0
    ? details
    : [{ full_name: booking.customer_full_name ?? "" }];
  const passenger = passengers[passengerIndex];
  if (!passenger) {
    return NextResponse.json({ error: "Invalid passenger index" }, { status: 400 });
  }

  const trip = booking.trip as { departure_date?: string; departure_time?: string; boat?: { name?: string } | null; route?: { display_name?: string } | null } | null;

  return NextResponse.json({
    valid: true,
    reference: booking.reference,
    passenger_index: passengerIndex,
    passenger_name: passenger.full_name ?? "",
    status: booking.status,
    trip: trip ? {
      date: trip.departure_date,
      time: trip.departure_time,
      vessel: trip.boat?.name ?? "—",
      route: trip.route?.display_name ?? "—",
    } : null,
  });
}
