-- Part 2 of 2: set default role for new profiles to 'passenger'.
-- Run after 005_add_passenger_role.sql (so the new enum value is committed).

ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT 'passenger';
