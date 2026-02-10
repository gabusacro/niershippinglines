-- Seed: Routes and 7 boats (run AFTER 001_initial_schema.sql)

-- Routes
INSERT INTO public.routes (origin, destination, display_name) VALUES
  ('Siargao Island', 'Surigao City', 'Siargao ↔ Surigao'),
  ('Surigao City', 'Siargao Island', 'Surigao ↔ Siargao'),
  ('Dinagat', 'Surigao City', 'Dinagat ↔ Surigao City'),
  ('Surigao City', 'Dinagat', 'Surigao City ↔ Dinagat')
ON CONFLICT (origin, destination) DO NOTHING;

-- 7 boats (capacity 200, online_quota 150 — adjust as needed)
INSERT INTO public.boats (name, capacity, online_quota, status) VALUES
  ('Boat 1', 200, 150, 'running'),
  ('Boat 2', 200, 150, 'running'),
  ('Boat 3', 200, 150, 'running'),
  ('Boat 4', 200, 150, 'running'),
  ('Boat 5', 200, 150, 'running'),
  ('Boat 6', 200, 150, 'running'),
  ('Boat 7', 200, 150, 'running')
ON CONFLICT DO NOTHING;

-- Fare rule: 550 PHP = 55000 cents, 20% discount for senior/pwd/child
-- Get route id for Siargao-Surigao (either direction use same base fare for now)
DO $$
DECLARE
  r_id UUID;
BEGIN
  SELECT id INTO r_id FROM public.routes WHERE origin = 'Siargao Island' AND destination = 'Surigao City' LIMIT 1;
  IF r_id IS NOT NULL THEN
    INSERT INTO public.fare_rules (route_id, base_fare_cents, discount_percent) VALUES (r_id, 55000, 20);
  END IF;
  SELECT id INTO r_id FROM public.routes WHERE origin = 'Surigao City' AND destination = 'Siargao Island' LIMIT 1;
  IF r_id IS NOT NULL THEN
    INSERT INTO public.fare_rules (route_id, base_fare_cents, discount_percent) VALUES (r_id, 55000, 20);
  END IF;
  SELECT id INTO r_id FROM public.routes WHERE origin = 'Dinagat' AND destination = 'Surigao City' LIMIT 1;
  IF r_id IS NOT NULL THEN
    INSERT INTO public.fare_rules (route_id, base_fare_cents, discount_percent) VALUES (r_id, 55000, 20);
  END IF;
  SELECT id INTO r_id FROM public.routes WHERE origin = 'Surigao City' AND destination = 'Dinagat' LIMIT 1;
  IF r_id IS NOT NULL THEN
    INSERT INTO public.fare_rules (route_id, base_fare_cents, discount_percent) VALUES (r_id, 55000, 20);
  END IF;
END $$;
