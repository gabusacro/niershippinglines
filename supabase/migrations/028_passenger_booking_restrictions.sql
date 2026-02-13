-- Passenger booking restrictions: warnings and block from purchasing.
-- Only admin and ticket_booth can view/update. Used to curb abuse (e.g. repeated
-- bookings without payment or proof).

CREATE TABLE public.passenger_booking_restrictions (
  profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  booking_warnings INT NOT NULL DEFAULT 0 CHECK (booking_warnings >= 0),
  booking_blocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT at_most_two_warnings CHECK (booking_warnings <= 2)
);

COMMENT ON TABLE public.passenger_booking_restrictions IS 'Per-passenger abuse control: warnings (1st, 2nd) and block from online booking. Admin and ticket_booth only.';
COMMENT ON COLUMN public.passenger_booking_restrictions.booking_warnings IS 'Number of warnings issued (1 = first warning, 2 = second warning).';
COMMENT ON COLUMN public.passenger_booking_restrictions.booking_blocked_at IS 'When set, this passenger cannot create new online bookings.';

CREATE INDEX idx_passenger_booking_restrictions_blocked ON public.passenger_booking_restrictions(profile_id) WHERE booking_blocked_at IS NOT NULL;

-- Only admin or ticket_booth can manage restrictions (no direct passenger access).
CREATE OR REPLACE FUNCTION public.current_user_is_admin_or_ticket_booth()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth')
  );
$$;

ALTER TABLE public.passenger_booking_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin or ticket_booth can manage passenger restrictions"
  ON public.passenger_booking_restrictions
  FOR ALL
  USING (public.current_user_is_admin_or_ticket_booth())
  WITH CHECK (public.current_user_is_admin_or_ticket_booth());
