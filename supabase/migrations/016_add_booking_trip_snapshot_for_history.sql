-- Snapshot of trip/vessel/route when booking is confirmed — preserved for 1 year even if trip/vessel deleted
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_snapshot_vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_route_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_date DATE,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_time TIME;

COMMENT ON COLUMN public.bookings.trip_snapshot_vessel_name IS 'Vessel name at confirmation — preserved when vessel deleted (1 year history)';
COMMENT ON COLUMN public.bookings.trip_snapshot_route_name IS 'Route display name at confirmation — preserved for passenger reference';
COMMENT ON COLUMN public.bookings.trip_snapshot_departure_date IS 'Departure date at confirmation';
COMMENT ON COLUMN public.bookings.trip_snapshot_departure_time IS 'Departure time at confirmation';

-- Allow trip_id NULL for historical bookings (trip deleted but booking kept for passenger history)
ALTER TABLE public.bookings ALTER COLUMN trip_id DROP NOT NULL;

-- Backfill existing confirmed/boarded/completed bookings from trip
UPDATE public.bookings b
SET
  trip_snapshot_vessel_name = bo.name,
  trip_snapshot_route_name = r.display_name,
  trip_snapshot_departure_date = t.departure_date,
  trip_snapshot_departure_time = t.departure_time
FROM public.trips t
LEFT JOIN public.boats bo ON bo.id = t.boat_id
LEFT JOIN public.routes r ON r.id = t.route_id
WHERE b.trip_id = t.id
  AND b.status IN ('confirmed', 'checked_in', 'boarded', 'completed')
  AND (b.trip_snapshot_vessel_name IS NULL OR b.trip_snapshot_route_name IS NULL);
