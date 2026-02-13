-- Allow passengers to read their own restrictions row (so dashboard can show warning/blocked notice).

CREATE POLICY "Passengers can read own restrictions"
  ON public.passenger_booking_restrictions
  FOR SELECT
  USING (profile_id = auth.uid());
