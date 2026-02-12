-- Store per-passenger fare type and name: array of { fare_type, full_name }
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS passenger_details JSONB;

COMMENT ON COLUMN public.bookings.passenger_details IS 'Array of { fare_type: adult|senior|pwd|child, full_name: string } when booking has mixed types and names; null for legacy single-type bookings.';
