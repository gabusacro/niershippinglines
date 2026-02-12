-- =============================================================================
-- SHIPPING LINES — Apply all missing migrations
-- Run this in Supabase Dashboard > SQL Editor
-- Safe to run multiple times (uses IF NOT EXISTS / IF EXISTS where possible)
-- =============================================================================

-- STEP 0: Diagnostic — run this first to see current state (optional)
-- Uncomment and run separately if you want to check before applying:
/*
SELECT column_name, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'bookings' 
AND column_name IN ('trip_id', 'trip_snapshot_vessel_name', 'trip_snapshot_route_name', 'refund_acknowledged_at')
ORDER BY column_name;
*/

-- =============================================================================
-- Migration 016 — CRITICAL for vessel/trip delete to work
-- =============================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS trip_snapshot_vessel_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_route_name TEXT,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_date DATE,
  ADD COLUMN IF NOT EXISTS trip_snapshot_departure_time TIME;

-- Allow trip_id NULL (required so we can unlink bookings when deleting trips)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'bookings' AND column_name = 'trip_id'
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.bookings ALTER COLUMN trip_id DROP NOT NULL;
  END IF;
END $$;

-- Backfill existing bookings with snapshot (safe to run multiple times)
UPDATE public.bookings b
SET
  trip_snapshot_vessel_name = COALESCE(b.trip_snapshot_vessel_name, bo.name),
  trip_snapshot_route_name = COALESCE(b.trip_snapshot_route_name, r.display_name),
  trip_snapshot_departure_date = COALESCE(b.trip_snapshot_departure_date, t.departure_date),
  trip_snapshot_departure_time = COALESCE(b.trip_snapshot_departure_time, t.departure_time)
FROM public.trips t
LEFT JOIN public.boats bo ON bo.id = t.boat_id
LEFT JOIN public.routes r ON r.id = t.route_id
WHERE b.trip_id = t.id
  AND b.status IN ('confirmed', 'checked_in', 'boarded', 'completed')
  AND (b.trip_snapshot_vessel_name IS NULL OR b.trip_snapshot_route_name IS NULL);

-- =============================================================================
-- Migration 017 — You said you ran this; safe to run again (IF NOT EXISTS)
-- =============================================================================
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS refund_acknowledged_at TIMESTAMPTZ;

ALTER TABLE public.refunds
  ADD COLUMN IF NOT EXISTS gcash_reference TEXT;

-- =============================================================================
-- Other common migrations (008, 012) — add columns if missing
-- =============================================================================
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS customer_mobile TEXT;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passenger_details JSONB;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS passenger_names TEXT[];
