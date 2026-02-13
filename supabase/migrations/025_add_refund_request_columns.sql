-- Passenger-initiated refund request (admin processes separately)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS refund_request_notes TEXT;

COMMENT ON COLUMN public.bookings.refund_requested_at IS 'When passenger requested a refund (admin processes via refund flow)';
COMMENT ON COLUMN public.bookings.refund_request_reason IS 'Passenger reason: weather_disturbance or vessel_cancellation';
COMMENT ON COLUMN public.bookings.refund_request_notes IS 'Optional notes from passenger for refund request';
