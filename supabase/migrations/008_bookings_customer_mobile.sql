-- Add mobile number to bookings for contact/SMS
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS customer_mobile TEXT;

COMMENT ON COLUMN public.bookings.customer_mobile IS 'Customer mobile number for contact (e.g. +63 9xx xxx xxxx)';
