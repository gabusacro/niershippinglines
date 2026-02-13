-- Attraction photo gallery: multiple images per attraction
CREATE TABLE IF NOT EXISTS public.attraction_images (
  id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  attraction_id UUID NOT NULL REFERENCES public.attractions(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

COMMENT ON TABLE public.attraction_images IS 'Extra photos for attraction gallery modal. Main thumbnail remains attractions.image_url.';

CREATE INDEX IF NOT EXISTS attraction_images_attraction_id_idx ON public.attraction_images(attraction_id);

ALTER TABLE public.attraction_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read attraction_images"
  ON public.attraction_images FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manage attraction_images"
  ON public.attraction_images FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
