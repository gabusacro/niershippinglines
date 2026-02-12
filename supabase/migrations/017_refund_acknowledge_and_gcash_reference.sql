-- Passenger can acknowledge refund receipt
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_acknowledged_at TIMESTAMPTZ;

COMMENT ON COLUMN public.bookings.refund_acknowledged_at IS 'When passenger acknowledged receipt of refund';

-- Admin stores GCash transaction reference for traceability
ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS gcash_reference TEXT;

COMMENT ON COLUMN public.refunds.gcash_reference IS 'GCash transaction reference for refund (for tracing)';
