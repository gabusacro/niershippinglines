-- Payment Processing Fee: ₱15 per transaction (online/GCash payments). Walk-in = 0.
-- Platform Service Fee: ₱15 per passenger (all bookings).
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS gcash_fee_cents INTEGER DEFAULT 0 CHECK (gcash_fee_cents >= 0),
  ADD COLUMN IF NOT EXISTS admin_fee_cents INTEGER DEFAULT 0 CHECK (admin_fee_cents >= 0);

COMMENT ON COLUMN bookings.gcash_fee_cents IS 'GCash convenience fee in centavos (₱15 per transaction for online; 0 for walk-in).';
COMMENT ON COLUMN bookings.admin_fee_cents IS 'Platform Service Fee in centavos (₱15 per passenger).';
