-- Add temporary block (e.g. 15-day spam block). When set and in the future, passenger cannot book.

ALTER TABLE public.passenger_booking_restrictions
  ADD COLUMN IF NOT EXISTS blocked_until TIMESTAMPTZ;

COMMENT ON COLUMN public.passenger_booking_restrictions.blocked_until IS 'When set and > now(), passenger cannot make new bookings until this time (e.g. 15-day spam penalty).';
