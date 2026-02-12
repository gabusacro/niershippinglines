-- New signups = passengers (booking, tickets, payment proof only).
-- Crew and captain are assigned by admin only.
-- Part 1 of 2: add enum value only. (Postgres cannot use a new enum value in the same transaction.)
-- Run this, then run 006_set_default_passenger_role.sql.

-- Use plain ADD VALUE (works on Postgres 9.1+). If you get "already exists", the value is there — then run 006.
ALTER TYPE app_role ADD VALUE 'passenger';
