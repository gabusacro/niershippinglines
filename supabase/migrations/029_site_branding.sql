-- Site branding: editable from admin. Single row. Used across app, tickets, manifest, emails.

CREATE TABLE public.site_branding (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  site_name TEXT NOT NULL DEFAULT 'Nier Shipping Lines',
  routes_text TEXT NOT NULL DEFAULT 'Siargao Island ↔ Surigao · Dinagat ↔ Surigao City',
  tagline TEXT NOT NULL DEFAULT 'Feel the island before you arrive. Sun, waves, and a smooth sail away.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.site_branding IS 'Editable site name, routes line, and tagline. Admin only can update; all can read.';

INSERT INTO public.site_branding (id, site_name, routes_text, tagline) VALUES (1, 'Nier Shipping Lines', 'Siargao Island ↔ Surigao · Dinagat ↔ Surigao City', 'Feel the island before you arrive. Sun, waves, and a smooth sail away.');

ALTER TABLE public.site_branding ENABLE ROW LEVEL SECURITY;

-- Everyone (including anon) can read so public pages, tickets, manifest show correct branding.
CREATE POLICY "Anyone can read site branding"
  ON public.site_branding FOR SELECT USING (true);

-- Only admin can update (uses existing current_user_is_admin() from profiles RLS).
CREATE POLICY "Admin can update site branding"
  ON public.site_branding FOR UPDATE USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Admin can insert site branding"
  ON public.site_branding FOR INSERT WITH CHECK (public.current_user_is_admin());
