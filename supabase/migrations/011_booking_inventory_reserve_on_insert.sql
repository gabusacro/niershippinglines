-- Reserve seats as soon as a booking is created (no overbooking).
-- Release seats when booking is cancelled, refunded, changed, or deleted.

-- 1) Reserve on INSERT (every new booking holds inventory)
CREATE OR REPLACE FUNCTION public.increment_trip_booked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_walk_in THEN
    UPDATE public.trips SET walk_in_booked = walk_in_booked + NEW.passenger_count, updated_at = NOW() WHERE id = NEW.trip_id;
  ELSE
    UPDATE public.trips SET online_booked = online_booked + NEW.passenger_count, updated_at = NOW() WHERE id = NEW.trip_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: only run on INSERT (no longer increment when status -> confirmed)
DROP TRIGGER IF EXISTS tr_bookings_increment_trip ON public.bookings;
CREATE TRIGGER tr_bookings_increment_trip
  AFTER INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.increment_trip_booked();

-- 2) Release on UPDATE when status moves to cancelled/refunded/changed (was pending_payment OR confirmed)
CREATE OR REPLACE FUNCTION public.decrement_trip_booked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('pending_payment', 'confirmed') AND NEW.status IN ('cancelled', 'changed', 'refunded') THEN
    IF OLD.is_walk_in THEN
      UPDATE public.trips SET walk_in_booked = GREATEST(0, walk_in_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    ELSE
      UPDATE public.trips SET online_booked = GREATEST(0, online_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3) Release on DELETE (booking row removed)
CREATE OR REPLACE FUNCTION public.decrement_trip_booked_on_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IN ('pending_payment', 'confirmed') THEN
    IF OLD.is_walk_in THEN
      UPDATE public.trips SET walk_in_booked = GREATEST(0, walk_in_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    ELSE
      UPDATE public.trips SET online_booked = GREATEST(0, online_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_bookings_decrement_trip ON public.bookings;
CREATE TRIGGER tr_bookings_decrement_trip
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.decrement_trip_booked();

DROP TRIGGER IF EXISTS tr_bookings_decrement_trip_on_delete ON public.bookings;
CREATE TRIGGER tr_bookings_decrement_trip_on_delete
  AFTER DELETE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.decrement_trip_booked_on_delete();
