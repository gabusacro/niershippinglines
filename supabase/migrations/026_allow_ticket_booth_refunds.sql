-- Allow ticket_booth to insert and read refunds (same business rules as admin: weather_disturbance, vessel_cancellation)
DROP POLICY IF EXISTS "Admin manage refunds" ON public.refunds;
CREATE POLICY "Admin manage refunds" ON public.refunds FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth'))
);
