-- Admin-editable fees: admin fee per passenger and GCash fee per transaction.
-- Single row (id=1). Used by booking, manual booking, and fare API. Fallback to app constants if not set.

CREATE TABLE public.fee_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  admin_fee_cents_per_passenger INT NOT NULL DEFAULT 2000 CHECK (admin_fee_cents_per_passenger >= 0),
  gcash_fee_cents INT NOT NULL DEFAULT 1500 CHECK (gcash_fee_cents >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.fee_settings IS 'Admin fee (₱/pax) and GCash fee (₱/transaction). Editable from Admin → Fees & charges.';

INSERT INTO public.fee_settings (id, admin_fee_cents_per_passenger, gcash_fee_cents)
VALUES (1, 2000, 1500)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fee_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read (booking and fare API need it)
CREATE POLICY "Anyone can read fee_settings"
  ON public.fee_settings FOR SELECT USING (true);

-- Only admin can update
CREATE POLICY "Admin can update fee_settings"
  ON public.fee_settings FOR UPDATE USING (public.current_user_is_admin())
  WITH CHECK (public.current_user_is_admin());

CREATE POLICY "Admin can insert fee_settings"
  ON public.fee_settings FOR INSERT WITH CHECK (public.current_user_is_admin());
