-- Allow walk-in to use whatever seats are left (capacity - online_booked), not capped by walk_in_quota.
-- So if 0 online booked, booth can enter up to full capacity; if 4 online, booth can enter up to 146.
ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS trips_walkin_cap;
ALTER TABLE public.trips ADD CONSTRAINT trips_walkin_cap CHECK (
  walk_in_booked <= (online_quota + walk_in_quota) - online_booked
);
COMMENT ON CONSTRAINT trips_walkin_cap ON public.trips IS 'Walk-in can use remaining capacity (online_quota + walk_in_quota - online_booked).';
