-- Add vessel/boat photo URL for passenger reference and ticket display
ALTER TABLE public.boats
ADD COLUMN IF NOT EXISTS image_url text;
COMMENT ON COLUMN public.boats.image_url IS 'URL of vessel photo for schedule and ticket display (e.g. ~1.5"×1.0" landscape)';
