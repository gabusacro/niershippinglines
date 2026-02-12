-- Optional second email to receive the same notifications (e.g. payment required, confirmation)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS notify_also_email TEXT;

COMMENT ON COLUMN public.bookings.notify_also_email IS 'Optional second email to receive payment/confirmation notifications (e.g. family or travel partner).';
