import { createClient } from "@/lib/supabase/server";

const MANIFEST_STATUSES = ["confirmed", "checked_in", "boarded", "completed"] as const;

/** One row per passenger (all names listed individually). */
export interface ManifestPassengerRow {
  seq: number;
  ticketNumber: string;
  reference: string;
  passengerName: string;
  fareType: string;
  gender: string | null;
  age: number | null;
  nationality: string | null;
  address: string | null;
  contact: string | null;
  source: string;
  status: string;
  checkedInAt: string | null;
  boardedAt: string | null;
}

export interface TripManifestData {
  tripId: string;
  vesselName: string;
  marinaNumber: string | null;
  routeName: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  capacity: number;
  onlineQuota: number;
  onlineBooked: number;
  walkInQuota: number;
  walkInBooked: number;
  availableSeats: number;
  /** All captains assigned to this boat (should be 1 — if multiple, shows all so admin can fix) */
  captainNames: string[];
  /** All crew assigned to this boat */
  crewNames: string[];
  passengers: ManifestPassengerRow[];
  totalListed: number;
  walkInNoNames: number;
  totalPassengers: number;
}

function calcAge(birthdate: string | null | undefined): number | null {
  if (!birthdate) return null;
  try {
    const birth = new Date(birthdate);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    const m = now.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
    return age >= 0 ? age : null;
  } catch {
    return null;
  }
}

export async function getTripManifestData(tripId: string): Promise<TripManifestData | null> {
  const supabase = await createClient();

  const { data: trip, error: tripError } = await supabase
    .from("trips")
    .select(`
      id, departure_date, departure_time,
      online_quota, online_booked, walk_in_quota, walk_in_booked,
      boat:boats(id, name, capacity, marina_number),
      route:routes(display_name, origin, destination)
    `)
    .eq("id", tripId)
    .single();

  if (tripError || !trip) return null;

  const boat = (Array.isArray(trip.boat) ? trip.boat[0] : trip.boat) as {
    id: string; name: string; capacity: number; marina_number?: string | null;
  } | null;
  const route = (Array.isArray(trip.route) ? trip.route[0] : trip.route) as {
    display_name?: string; origin?: string; destination?: string;
  } | null;

  const capacity = boat?.capacity ?? (trip.online_quota ?? 0) + (trip.walk_in_quota ?? 0);
  const oq = trip.online_quota ?? 0;
  const ob = trip.online_booked ?? 0;
  const wq = trip.walk_in_quota ?? 0;
  const wb = trip.walk_in_booked ?? 0;
  const availableSeats = Math.max(0, capacity - ob - wb);

  // Fetch captains and crew from boat_assignments
  let captainNames: string[] = [];
  let crewNames: string[] = [];

  if (boat?.id) {
    const { data: assignments } = await supabase
      .from("boat_assignments")
      .select("assignment_role, profile:profiles(full_name)")
      .eq("boat_id", boat.id)
      .in("assignment_role", ["captain", "deck_crew"]);

    for (const a of assignments ?? []) {
      const profile = Array.isArray(a.profile) ? a.profile[0] : a.profile;
      const name = (profile as { full_name?: string } | null)?.full_name ?? null;
      if (!name) continue;
      if (a.assignment_role === "captain") captainNames.push(name);
      else crewNames.push(name);
    }
  }

  // Fetch bookings
  const { data: bookings, error: bookError } = await supabase
    .from("bookings")
    .select("id, reference, customer_full_name, customer_mobile, customer_address, fare_type, passenger_count, passenger_details, is_walk_in, created_by, status, checked_in_at, boarded_at")
    .eq("trip_id", tripId)
    .in("status", [...MANIFEST_STATUSES])
    .order("created_at", { ascending: true });

  if (bookError) return null;

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const ticketsByBooking = new Map<string, {
    ticket_number: string; passenger_index: number;
    status: string; checked_in_at: string | null; boarded_at: string | null;
  }[]>();

  if (bookingIds.length > 0) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("ticket_number, booking_id, passenger_index, status, checked_in_at, boarded_at")
      .in("booking_id", bookingIds);
    for (const t of tickets ?? []) {
      if (!ticketsByBooking.has(t.booking_id)) ticketsByBooking.set(t.booking_id, []);
      ticketsByBooking.get(t.booking_id)!.push(t);
    }
  }

  const creatorIds = [...new Set((bookings ?? []).map((b) => b.created_by).filter(Boolean))] as string[];
  const creators = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: profs } = await supabase.from("profiles").select("id, role").in("id", creatorIds);
    for (const p of profs ?? []) creators.set(p.id, p.role ?? "—");
  }

  let seq = 0;
  const passengers: ManifestPassengerRow[] = [];
  const fareTypeLabels: Record<string, string> = {
    adult: "Adult", senior: "Senior", pwd: "PWD", child: "Child", infant: "Infant",
  };

  for (const b of bookings ?? []) {
    const pd = (b.passenger_details ?? []) as {
      fare_type?: string; full_name?: string; address?: string;
      ticket_number?: string; gender?: string; birthdate?: string;
      age?: number; nationality?: string;
    }[];

    const bookingFareType = (b as { fare_type?: string }).fare_type ?? "adult";
    const bookingAddress = (b as { customer_address?: string | null }).customer_address?.trim() || null;
    const role = b.created_by ? creators.get(b.created_by) : null;
    const bookingStatus = (b as { status?: string }).status ?? "confirmed";
    const bookingTickets = ticketsByBooking.get(b.id) ?? [];
    const ticketByIndex = new Map(bookingTickets.map((t) => [t.passenger_index, t]));
    const contact = (b as { customer_mobile?: string | null }).customer_mobile?.trim() || null;
    const ref = b.reference ?? "—";

    let source = "Online";
    if (b.is_walk_in) {
      source = role === "ticket_booth" ? "Walk-in (booth)" : role === "admin" ? "Walk-in (admin)" : "Walk-in";
    }

    if (pd.length > 0) {
      for (let i = 0; i < pd.length; i++) {
        const p = pd[i]!;
        const name = (p.full_name ?? "—").trim() || "—";
        const fareType = fareTypeLabels[p.fare_type ?? ""] ?? (p.fare_type ?? bookingFareType);
        const address = (p.address && p.address.trim()) ? p.address.trim() : bookingAddress;
        const gender = p.gender ?? null;
        const age = p.age ?? calcAge(p.birthdate ?? null);
        const nationality = p.nationality ?? null;
        const ticket = ticketByIndex.get(i);
        const ticketNumber = ticket?.ticket_number ?? (p.ticket_number ? String(p.ticket_number).trim() : ref);
        const status = ticket?.status ?? bookingStatus;
        const checkedInAt = ticket?.checked_in_at ?? null;
        const boardedAt = ticket?.boarded_at ?? null;
        seq += 1;
        passengers.push({ seq, ticketNumber, reference: ref, passengerName: name, fareType, gender, age, nationality, address, contact, source, status, checkedInAt, boardedAt });
      }
    } else {
      const name = b.customer_full_name ?? "—";
      const fareType = fareTypeLabels[bookingFareType] ?? bookingFareType;
      const ticket = ticketByIndex.get(0);
      const status = ticket?.status ?? bookingStatus;
      const checkedInAt = ticket?.checked_in_at ?? null;
      const boardedAt = ticket?.boarded_at ?? null;
      seq += 1;
      passengers.push({ seq, ticketNumber: ticket?.ticket_number ?? ref, reference: ref, passengerName: name, fareType, gender: null, age: null, nationality: null, address: bookingAddress, contact, source, status, checkedInAt, boardedAt });
    }
  }

  const totalListed = passengers.length;
  const walkInFromBookings = (bookings ?? [])
    .filter((b) => b.is_walk_in)
    .reduce((s, b) => s + (b.passenger_count ?? 0), 0);
  const walkInNoNames = Math.max(0, wb - walkInFromBookings);
  const totalPassengers = totalListed + walkInNoNames;

  return {
    tripId: trip.id,
    vesselName: boat?.name ?? "—",
    marinaNumber: boat?.marina_number ?? null,
    routeName: route?.display_name ?? [route?.origin, route?.destination].filter(Boolean).join(" → ") ?? "—",
    origin: route?.origin ?? "—",
    destination: route?.destination ?? "—",
    departureDate: trip.departure_date ?? "—",
    departureTime: trip.departure_time ?? "—",
    capacity,
    onlineQuota: oq,
    onlineBooked: ob,
    walkInQuota: wq,
    walkInBooked: wb,
    availableSeats,
    captainNames,
    crewNames,
    passengers,
    totalListed,
    walkInNoNames,
    totalPassengers,
  };
}
