-- Unique ticket number per passenger (not per booking).
-- Crew, captain, and ticket booth can identify each ticket by this number on manifest and when scanning.

CREATE TABLE IF NOT EXISTS public.tickets (
  ticket_number TEXT PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  passenger_index INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_booking ON public.tickets(booking_id);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Only admin/ticket_booth assign ticket numbers (on confirm-payment or manual booking)
DROP POLICY IF EXISTS "Admin and ticket_booth insert tickets" ON public.tickets;
CREATE POLICY "Admin and ticket_booth insert tickets"
  ON public.tickets
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth'))
  );

-- Staff (crew, captain, ticket_booth, admin) can read tickets for validation and manifest
DROP POLICY IF EXISTS "Staff read tickets" ON public.tickets;
CREATE POLICY "Staff read tickets"
  ON public.tickets
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth', 'crew', 'captain'))
  );

-- Generate N unique ticket numbers and insert into tickets for a booking. Returns the array of ticket numbers.
CREATE OR REPLACE FUNCTION public.generate_and_assign_ticket_numbers(
  p_booking_id UUID,
  p_count INT
)
RETURNS TEXT[] AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT[] := '{}';
  i INT;
  j INT;
  code TEXT;
  done BOOLEAN;
BEGIN
  IF p_count < 1 THEN
    RETURN result;
  END IF;
  FOR i IN 0..(p_count - 1) LOOP
    done := false;
    WHILE NOT done LOOP
      code := '';
      FOR j IN 1..10 LOOP
        code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
      END LOOP;
      IF NOT EXISTS (SELECT 1 FROM public.tickets WHERE ticket_number = code) THEN
        INSERT INTO public.tickets (ticket_number, booking_id, passenger_index)
        VALUES (code, p_booking_id, i);
        result := result || code;
        done := true;
      END IF;
    END LOOP;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
