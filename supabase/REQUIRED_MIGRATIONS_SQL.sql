-- =============================================================================
-- Run this in Supabase Dashboard > SQL Editor if migrations 016 and 017
-- have not been applied. This fixes: trip/vessel delete, refund acknowledge,
-- My Bookings, booking detail, and refund notice.
-- =============================================================================

-- Migration 016: Trip snapshot + nullable trip_id (required for delete to work)
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_snapshot_vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_route_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_date DATE,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_time TIME;

ALTER TABLE public.bookings ALTER COLUMN trip_id DROP NOT NULL;

-- Migration 017: Refund acknowledge + GCash reference
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_acknowledged_at TIMESTAMPTZ;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS gcash_reference TEXT;
