-- When admin requests passenger to resend proof (wrong screenshot, no reference visible)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS proof_resend_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gcash_transaction_reference TEXT;

COMMENT ON COLUMN public.bookings.proof_resend_requested_at IS 'When admin requested passenger to resend payment proof (wrong screenshot or no reference visible)';
COMMENT ON COLUMN public.bookings.gcash_transaction_reference IS 'Manual GCash transaction reference entered by passenger when screenshot cannot be uploaded';
