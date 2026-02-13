import { createClient } from "@/lib/supabase/server";

type PassengerDetail = { fare_type?: string; full_name?: string; address?: string; ticket_number?: string };

/**
 * Generates unique ticket numbers for each passenger and stores them in
 * the tickets table and in booking.passenger_details[].ticket_number.
 * Call after confirming a booking (confirm-payment) or creating a manual booking.
 * Idempotent: if passenger_details already have ticket_number, skips.
 */
export async function assignTicketNumbersToBooking(bookingId: string): Promise<{ ticketNumbers: string[] } | null> {
  const supabase = await createClient();
  const { data: booking, error: fetchError } = await supabase
    .from("bookings")
    .select("passenger_details, passenger_count, fare_type, customer_full_name")
    .eq("id", bookingId)
    .single();

  if (fetchError || !booking) return null;

  const pd = (booking.passenger_details ?? []) as PassengerDetail[];
  const count = pd.length > 0 ? pd.length : Math.max(1, (booking.passenger_count ?? 1));

  if (count < 1) return null;

  if (pd.length > 0 && pd.every((p) => typeof p.ticket_number === "string" && p.ticket_number.trim().length > 0)) {
    return { ticketNumbers: pd.map((p) => (p.ticket_number ?? "").trim()) };
  }

  const { data: ticketNumbers, error: rpcError } = await supabase.rpc("generate_and_assign_ticket_numbers", {
    p_booking_id: bookingId,
    p_count: count,
  });

  if (rpcError || !Array.isArray(ticketNumbers) || ticketNumbers.length !== count) {
    return null;
  }

  let updatedDetails: PassengerDetail[];
  if (pd.length > 0) {
    updatedDetails = pd.map((p, i) => ({ ...p, ticket_number: ticketNumbers[i] ?? "" }));
  } else {
    const fareType = (booking.fare_type ?? "adult") as string;
    const fullName = (booking.customer_full_name ?? "").trim();
    updatedDetails = (ticketNumbers as string[]).map((code) => ({
      fare_type: fareType,
      full_name: fullName,
      ticket_number: code,
    }));
  }

  const { error: updateError } = await supabase
    .from("bookings")
    .update({ passenger_details: updatedDetails, updated_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (updateError) return null;
  return { ticketNumbers: ticketNumbers as string[] };
}
