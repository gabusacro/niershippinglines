-- Allow admin to delete bookings (needed when removing trips with pending/cancelled bookings)
CREATE POLICY "Admin can delete bookings" ON public.bookings
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
