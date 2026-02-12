-- Announcements/updates for passengers: per vessel or all vessels (e.g. weather).
-- Admin can post for one vessel or "all vessels"; captain can post only for their assigned vessel.
CREATE TABLE IF NOT EXISTS public.vessel_announcements (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  vessel_id UUID REFERENCES public.boats(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_until TIMESTAMPTZ
);

COMMENT ON TABLE public.vessel_announcements IS 'Announcements for passengers: vessel_id NULL = all vessels (e.g. weather); otherwise per vessel. Shown on Schedule and Book pages.';
COMMENT ON COLUMN public.vessel_announcements.vessel_id IS 'NULL = applies to all vessels; otherwise this vessel only.';
COMMENT ON COLUMN public.vessel_announcements.active_until IS 'Optional: do not show after this time (e.g. end of day).';

CREATE INDEX IF NOT EXISTS idx_vessel_announcements_vessel ON public.vessel_announcements(vessel_id);
CREATE INDEX IF NOT EXISTS idx_vessel_announcements_created_at ON public.vessel_announcements(created_at DESC);

ALTER TABLE public.vessel_announcements ENABLE ROW LEVEL SECURITY;

-- Anyone can read (for Schedule/Book pages)
CREATE POLICY "Public read vessel_announcements" ON public.vessel_announcements
  FOR SELECT USING (true);

-- Admin can insert/update/delete any. Captain access enforced in API (boat_assignments).
CREATE POLICY "Admin manage vessel_announcements" ON public.vessel_announcements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Captain: can insert announcements for a vessel (API enforces assigned vessel via boat_assignments)
CREATE POLICY "Captain insert vessel_announcements" ON public.vessel_announcements
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'captain')
    AND vessel_id IS NOT NULL
  );

-- Captain: can update/delete only their own announcements
CREATE POLICY "Captain update delete own announcements" ON public.vessel_announcements
  FOR ALL
  USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'captain')
  );
