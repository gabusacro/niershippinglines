-- Run this in Supabase SQL Editor to see which migration columns exist
-- Copy results and share if you need help diagnosing

SELECT 
  column_name, 
  data_type, 
  is_nullable,
  CASE 
    WHEN column_name = 'trip_snapshot_vessel_name' THEN '016'
    WHEN column_name = 'trip_snapshot_route_name' THEN '016'
    WHEN column_name = 'trip_snapshot_departure_date' THEN '016'
    WHEN column_name = 'trip_snapshot_departure_time' THEN '016'
    WHEN column_name = 'refund_acknowledged_at' THEN '017'
    WHEN column_name = 'gcash_reference' THEN '017 (refunds table)'
    WHEN column_name = 'customer_mobile' THEN '008'
    WHEN column_name = 'passenger_names' THEN '012'
    ELSE 'other'
  END as migration
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (
    (table_name = 'bookings' AND column_name IN ('trip_id', 'trip_snapshot_vessel_name', 'trip_snapshot_route_name', 'trip_snapshot_departure_date', 'trip_snapshot_departure_time', 'refund_acknowledged_at', 'customer_mobile', 'passenger_names'))
    OR (table_name = 'refunds' AND column_name = 'gcash_reference')
  )
ORDER BY table_name, column_name;
