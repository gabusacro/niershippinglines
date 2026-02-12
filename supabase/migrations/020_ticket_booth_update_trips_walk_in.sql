-- Ticket booth must be able to update walk_in_booked on trips for manifest/reports.
CREATE POLICY "Ticket booth update trips walk_in_booked" ON public.trips
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ticket_booth'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'ticket_booth'));
