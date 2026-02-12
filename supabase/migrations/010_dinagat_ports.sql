-- Dinagat Island ports: Loreto, Valencia, San Jose (can change weekly/daily per trip)
-- Siargao uses Port of Dapa (we can add it later if needed for display)

CREATE TABLE IF NOT EXISTS public.ports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  region TEXT,  -- e.g. 'Dinagat Island', 'Siargao Island'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Dinagat Island ports
INSERT INTO public.ports (name, region) VALUES
  ('Loreto', 'Dinagat Island'),
  ('Valencia', 'Dinagat Island'),
  ('San Jose', 'Dinagat Island')
ON CONFLICT (name) DO NOTHING;

-- Trip-level port: for Dinagat routes, which port (Loreto/Valencia/San Jose) this trip uses
ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS port_id UUID REFERENCES public.ports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_port ON public.trips(port_id);

COMMENT ON COLUMN public.trips.port_id IS 'For Dinagat ↔ Surigao routes: which Dinagat port (Loreto, Valencia, San Jose). Null for Siargao or when not set.';

-- RLS: public can read ports
ALTER TABLE public.ports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read ports" ON public.ports FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin manage ports" ON public.ports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
