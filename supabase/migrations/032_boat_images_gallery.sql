-- Vessel photo gallery: multiple images per boat for schedule page modal
CREATE TABLE IF NOT EXISTS public.boat_images (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.boat_images IS 'Extra vessel photos for schedule gallery modal. Main thumbnail remains boats.image_url.';

CREATE INDEX IF NOT EXISTS boat_images_boat_id_idx ON public.boat_images(boat_id);

ALTER TABLE public.boat_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read boat_images"
  ON public.boat_images FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage boat_images"
  ON public.boat_images FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
