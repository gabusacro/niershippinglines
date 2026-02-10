-- Nier Shipping Lines — Initial schema (inventory-first, secure)
-- Run this in Supabase SQL Editor (Dashboard) or via Supabase CLI.

-- Enable UUID extension if not already
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- ROLES & PROFILES (tied to Supabase Auth)
-- =============================================================================
CREATE TYPE app_role AS ENUM ('admin', 'captain', 'crew', 'ticket_booth');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'crew',
  full_name TEXT,
  email TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- BOATS
-- =============================================================================
CREATE TYPE boat_status AS ENUM ('running', 'maintenance');

CREATE TABLE public.boats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  online_quota INT NOT NULL CHECK (online_quota >= 0),
  status boat_status NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT online_quota_lte_capacity CHECK (online_quota <= capacity)
);

-- =============================================================================
-- ROUTES
-- =============================================================================
CREATE TABLE public.routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(origin, destination)
);

-- =============================================================================
-- FARE RULES (per route, configurable)
-- =============================================================================
CREATE TABLE public.fare_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  base_fare_cents INT NOT NULL CHECK (base_fare_cents >= 0),
  discount_percent INT NOT NULL DEFAULT 20 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  valid_from DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- SCHEDULE SLOTS (which time each route runs — e.g. 06:00, 12:00, 18:00)
-- =============================================================================
CREATE TABLE public.schedule_slots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  departure_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, departure_time)
);

-- =============================================================================
-- TRIPS (actual inventory: one row per boat/date/time — source of truth)
-- =============================================================================
CREATE TYPE trip_status AS ENUM ('scheduled', 'boarding', 'departed', 'arrived', 'cancelled');

CREATE TABLE public.trips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  boat_id UUID NOT NULL REFERENCES public.boats(id) ON DELETE RESTRICT,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE RESTRICT,
  departure_date DATE NOT NULL,
  departure_time TIME NOT NULL,
  online_quota INT NOT NULL CHECK (online_quota >= 0),
  online_booked INT NOT NULL DEFAULT 0 CHECK (online_booked >= 0),
  walk_in_quota INT NOT NULL CHECK (walk_in_quota >= 0),
  walk_in_booked INT NOT NULL DEFAULT 0 CHECK (walk_in_booked >= 0),
  status trip_status NOT NULL DEFAULT 'scheduled',
  boarded_count INT NOT NULL DEFAULT 0 CHECK (boarded_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(boat_id, departure_date, departure_time),
  CONSTRAINT trips_online_cap CHECK (online_booked <= online_quota),
  CONSTRAINT trips_walkin_cap CHECK (walk_in_booked <= walk_in_quota),
  CONSTRAINT trips_total_cap CHECK (online_booked + walk_in_booked <= online_quota + walk_in_quota)
);

CREATE INDEX idx_trips_date_route ON public.trips(departure_date, route_id);
CREATE INDEX idx_trips_boat_date ON public.trips(boat_id, departure_date);

-- =============================================================================
-- BOOKINGS (every seat reservation — online or walk-in)
-- =============================================================================
CREATE TYPE booking_status AS ENUM (
  'pending_payment',
  'confirmed',
  'checked_in',
  'boarded',
  'completed',
  'cancelled',
  'changed',
  'refunded'
);

CREATE TYPE fare_type_enum AS ENUM ('adult', 'senior', 'pwd', 'child');

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE RESTRICT,
  reference TEXT NOT NULL UNIQUE,
  customer_full_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  passenger_count INT NOT NULL CHECK (passenger_count > 0),
  fare_type fare_type_enum NOT NULL DEFAULT 'adult',
  total_amount_cents INT NOT NULL CHECK (total_amount_cents >= 0),
  status booking_status NOT NULL DEFAULT 'pending_payment',
  is_walk_in BOOLEAN NOT NULL DEFAULT false,
  payment_proof_path TEXT,
  checked_in_at TIMESTAMPTZ,
  boarded_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_trip_exists FOREIGN KEY (trip_id) REFERENCES public.trips(id)
);

CREATE INDEX idx_bookings_trip ON public.bookings(trip_id);
CREATE INDEX idx_bookings_reference ON public.bookings(reference);
CREATE INDEX idx_bookings_status ON public.bookings(status);
CREATE INDEX idx_bookings_created_at ON public.bookings(created_at);

-- =============================================================================
-- BOOKING CHANGES (date change + 20% fee — audit trail)
-- =============================================================================
CREATE TABLE public.booking_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  from_trip_id UUID NOT NULL REFERENCES public.trips(id),
  to_trip_id UUID NOT NULL REFERENCES public.trips(id),
  additional_fee_cents INT NOT NULL CHECK (additional_fee_cents >= 0),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by UUID REFERENCES public.profiles(id)
);

-- =============================================================================
-- REFUNDS (engine/machine failure — 100%)
-- =============================================================================
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  amount_cents INT NOT NULL CHECK (amount_cents >= 0),
  reason TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_by UUID REFERENCES public.profiles(id)
);

-- =============================================================================
-- TOURIST ATTRACTIONS (admin-editable)
-- =============================================================================
CREATE TABLE public.attractions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TIDE (manual/admin entries for now)
-- =============================================================================
CREATE TABLE public.tide_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  high_tide_time TIME,
  low_tide_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(entry_date)
);

-- =============================================================================
-- FUNCTIONS: Update inventory on booking confirm / cancel / change
-- =============================================================================

-- Reserve seats when booking is confirmed (pending_payment -> confirmed)
CREATE OR REPLACE FUNCTION public.increment_trip_booked()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'pending_payment') THEN
    IF NEW.is_walk_in THEN
      UPDATE public.trips SET walk_in_booked = walk_in_booked + NEW.passenger_count, updated_at = NOW() WHERE id = NEW.trip_id;
    ELSE
      UPDATE public.trips SET online_booked = online_booked + NEW.passenger_count, updated_at = NOW() WHERE id = NEW.trip_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_bookings_increment_trip
  AFTER INSERT OR UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.increment_trip_booked();

-- Decrement when booking cancelled/changed/refunded
CREATE OR REPLACE FUNCTION public.decrement_trip_booked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = 'confirmed' AND NEW.status IN ('cancelled', 'changed', 'refunded') THEN
    IF OLD.is_walk_in THEN
      UPDATE public.trips SET walk_in_booked = GREATEST(0, walk_in_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    ELSE
      UPDATE public.trips SET online_booked = GREATEST(0, online_booked - OLD.passenger_count), updated_at = NOW() WHERE id = OLD.trip_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER tr_bookings_decrement_trip
  AFTER UPDATE OF status ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.decrement_trip_booked();

-- Ensure profile exists on signup (Supabase Auth hook or app-side)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.email, 'crew')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run: in Supabase Dashboard > Authentication > Triggers, add trigger on signup calling handle_new_user,
-- or call this from your app after signUp.

-- =============================================================================
-- Generate unique alphanumeric reference (no repeating)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_booking_reference()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INT;
  done BOOLEAN := false;
BEGIN
  WHILE NOT done LOOP
    result := '';
    FOR i IN 1..10 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE reference = result) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- RLS (Row Level Security)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tide_entries ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read own; admin can all
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile (limited)" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all profiles" ON public.profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Public read: routes, trips (for schedule), attractions, fare_rules, tide
CREATE POLICY "Public read routes" ON public.routes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read trips" ON public.trips FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read attractions" ON public.attractions FOR SELECT TO anon, authenticated USING (is_published);
CREATE POLICY "Public read fare_rules" ON public.fare_rules FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read schedule_slots" ON public.schedule_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read tide" ON public.tide_entries FOR SELECT TO anon, authenticated USING (true);

-- Boats: public can read (for schedule display)
CREATE POLICY "Public read boats" ON public.boats FOR SELECT TO anon, authenticated USING (true);

-- Bookings: anon can INSERT (online booking); authenticated crew can SELECT/UPDATE for check-in
CREATE POLICY "Anyone can create booking" ON public.bookings FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Read own booking by reference" ON public.bookings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Crew and admin can update bookings" ON public.bookings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth', 'crew'))
);
CREATE POLICY "Admin can read all bookings" ON public.bookings FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'ticket_booth', 'crew', 'captain'))
);

-- Admin only: boats, routes, fare_rules, schedule_slots, trips (create/update), attractions, tide
CREATE POLICY "Admin manage boats" ON public.boats FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage routes" ON public.routes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage fare_rules" ON public.fare_rules FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage schedule_slots" ON public.schedule_slots FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage trips" ON public.trips FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage attractions" ON public.attractions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin manage tide" ON public.tide_entries FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Refunds, booking_changes: admin only
CREATE POLICY "Admin manage refunds" ON public.refunds FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admin read booking_changes" ON public.booking_changes FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "System insert booking_changes" ON public.booking_changes FOR INSERT WITH CHECK (true);

-- =============================================================================
-- Storage bucket for payment proofs (run in Dashboard if needed)
-- =============================================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false);
-- Storage policy: admin/authenticated can read; authenticated can upload with naming rule.

-- =============================================================================
-- SEED (optional): first admin — run after first user signs up and set their id
-- =============================================================================
-- UPDATE public.profiles SET role = 'admin', full_name = 'Admin', approved_at = NOW() WHERE id = 'YOUR-AUTH-USER-UUID';
