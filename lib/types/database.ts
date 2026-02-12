// Types aligned with Supabase schema (001_initial_schema.sql)

export type AppRole = "admin" | "captain" | "crew" | "ticket_booth" | "passenger";
export type BoatStatus = "running" | "maintenance";
export type TripStatus = "scheduled" | "boarding" | "departed" | "arrived" | "cancelled";
export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "boarded"
  | "completed"
  | "cancelled"
  | "changed"
  | "refunded";
export type FareType = "adult" | "senior" | "pwd" | "child" | "infant";

export interface Profile {
  id: string;
  role: AppRole;
  full_name: string | null;
  salutation: string | null;
  email: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Boat {
  id: string;
  name: string;
  capacity: number;
  online_quota: number;
  status: BoatStatus;
  image_url?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Route {
  id: string;
  origin: string;
  destination: string;
  display_name: string;
  created_at: string;
  updated_at: string;
}

export interface FareRule {
  id: string;
  route_id: string;
  base_fare_cents: number;
  discount_percent: number;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleSlot {
  id: string;
  route_id: string;
  departure_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Trip {
  id: string;
  boat_id: string;
  route_id: string;
  departure_date: string;
  departure_time: string;
  online_quota: number;
  online_booked: number;
  walk_in_quota: number;
  walk_in_booked: number;
  status: TripStatus;
  boarded_count: number;
  created_at: string;
  updated_at: string;
  boat?: Boat;
  route?: Route;
}

export type PassengerDetail = { fare_type: FareType; full_name: string };

export interface Booking {
  id: string;
  trip_id: string;
  reference: string;
  customer_full_name: string;
  customer_email: string;
  customer_mobile: string | null;
  passenger_count: number;
  fare_type: FareType;
  total_amount_cents: number;
  passenger_details: PassengerDetail[] | null;
  status: BookingStatus;
  is_walk_in: boolean;
  payment_proof_path: string | null;
  checked_in_at: string | null;
  boarded_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  trip?: Trip;
}

export interface Attraction {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TideEntry {
  id: string;
  entry_date: string;
  high_tide_time: string | null;
  low_tide_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface VesselAnnouncement {
  id: string;
  vessel_id: string | null;
  created_by: string;
  message: string;
  created_at: string;
  active_until: string | null;
}
