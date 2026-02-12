-- Fuel per trip (default 100L, lockable) and boat staff assignments

-- Boats: default fuel liters per trip (set manually, then lock)
ALTER TABLE public.boats
  ADD COLUMN IF NOT EXISTS default_fuel_liters_per_trip INT NOT NULL DEFAULT 100 CHECK (default_fuel_liters_per_trip >= 0),
  ADD COLUMN IF NOT EXISTS fuel_liters_locked BOOLEAN NOT NULL DEFAULT false;

-- Trips: actual fuel used (optional; if null, use boat default for reporting)
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS fuel_liters_used INT CHECK (fuel_liters_used IS NULL OR fuel_liters_used >= 0);

-- Boat assignments: captain, deck crew, ticket booth (assigned by admin per vessel)
CREATE TYPE boat_assignment_role AS ENUM ('captain', 'deck_crew', 'ticket_booth');

CREATE TABLE IF NOT EXISTS public.boat_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignment_role boat_assignment_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(boat_id, profile_id, assignment_role)
);

CREATE INDEX IF NOT EXISTS idx_boat_assignments_boat ON public.boat_assignments(boat_id);
CREATE INDEX IF NOT EXISTS idx_boat_assignments_profile ON public.boat_assignments(profile_id);

ALTER TABLE public.boat_assignments ENABLE ROW LEVEL SECURITY;

-- Only admin can manage boat_assignments
CREATE POLICY "Admin manage boat_assignments" ON public.boat_assignments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
-- Staff can read their own assignments
CREATE POLICY "Staff read own boat_assignments" ON public.boat_assignments
  FOR SELECT USING (profile_id = auth.uid());
