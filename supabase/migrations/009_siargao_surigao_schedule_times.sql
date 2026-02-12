-- Siargao ↔ Surigao departure times (per user spec)
-- Surigao → Siargao: 5:30 AM, 12 PM
-- Siargao → Surigao: 8:30 AM, 4 PM

-- Remove existing schedule_slots for Siargao Island ↔ Surigao City (both directions)
DELETE FROM public.schedule_slots
WHERE route_id IN (
  SELECT id FROM public.routes
  WHERE (origin = 'Siargao Island' AND destination = 'Surigao City')
     OR (origin = 'Surigao City' AND destination = 'Siargao Island')
);

-- Surigao City → Siargao Island: 5:30 AM, 12:00 PM
INSERT INTO public.schedule_slots (route_id, departure_time, is_active)
SELECT id, t.dep, true
FROM public.routes r
CROSS JOIN (VALUES ('05:30'::time), ('12:00'::time)) AS t(dep)
WHERE r.origin = 'Surigao City' AND r.destination = 'Siargao Island'
ON CONFLICT (route_id, departure_time) DO NOTHING;

-- Siargao Island → Surigao City: 8:30 AM, 4:00 PM
INSERT INTO public.schedule_slots (route_id, departure_time, is_active)
SELECT id, t.dep, true
FROM public.routes r
CROSS JOIN (VALUES ('08:30'::time), ('16:00'::time)) AS t(dep)
WHERE r.origin = 'Siargao Island' AND r.destination = 'Surigao City'
ON CONFLICT (route_id, departure_time) DO NOTHING;

-- Remove future trips for these routes (only those with no bookings) so they can be recreated from new schedule_slots
DELETE FROM public.trips t
WHERE t.route_id IN (
  SELECT id FROM public.routes
  WHERE (origin = 'Siargao Island' AND destination = 'Surigao City')
     OR (origin = 'Surigao City' AND destination = 'Siargao Island')
)
AND t.departure_date >= CURRENT_DATE
AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.trip_id = t.id);
