# Booking and Payment Flow (Nier Shipping Lines)

## How booking and inventory work

1. **Create booking** (POST `/api/booking`)
   - User picks route, date, departure time, fare type, passengers, and contact details.
   - API checks trip exists, is `scheduled`, and has enough **available** seats (`online_quota - online_booked >= passenger_count`).
   - A unique **reference** is generated (Supabase RPC `generate_booking_reference`).
   - Fare is computed from `fare_rules` (route, date): `per_person = base_fare_cents` (adult) or `base × (1 - discount_percent/100)` (senior/pwd/child).
   - **Total = per_person × passenger_count** (same formula in API and frontend).
   - Row is inserted into **Supabase `bookings`** with status `pending_payment`.
   - **Inventory:** A DB trigger runs on INSERT and adds `passenger_count` to `trips.online_booked`. Seats are reserved as soon as the booking is created, so no overbooking.

2. **Data storage (no data loss)**
   - All booking data is stored in **Supabase** (`bookings` table): reference, trip_id, customer details, passenger_count, fare_type, total_amount_cents, status, created_at, etc.
   - Trip inventory is updated in **Supabase** (`trips.online_booked`) by triggers. No separate app logic that could get out of sync.
   - If a booking is **cancelled**, **refunded**, or **changed**, triggers decrement `online_booked` so seats are released.

3. **Payment flow**
   - Status stays `pending_payment` until payment is confirmed (e.g. at ticket booth or after proof upload).
   - Admin/crew can update status to `confirmed` (and optionally set `payment_proof_path`). No extra inventory change at confirm—seats were already reserved on create.
   - Fare calculation is done once at booking time and stored in `total_amount_cents`; display uses the same breakdown (per person × count = total).

4. **Look up a booking**
   - **GET** `/api/booking?reference=XXXX` returns the booking (and nested trip/route) from Supabase. Use for “view my booking” or staff lookup.

## Transaction flow summary

| Step | Where | What |
|------|--------|------|
| User submits form | Frontend | Sends trip_id, customer_*, passenger_count, fare_type |
| Validate & compute | API | Check trip, availability, fare_rules; compute total |
| Insert booking | Supabase `bookings` | One row with reference, total_amount_cents, status=pending_payment |
| Reserve seats | DB trigger | `trips.online_booked += passenger_count` (same transaction as insert) |
| Response | API | Returns reference, total_amount_cents, fare_breakdown, status |
| Cancel/refund/change | Admin/API | Update status → trigger releases seats |

## Supabase connection

- Server APIs use `createClient()` from `@/lib/supabase/server` (cookie-based auth).
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
- Errors from Supabase (RPC, select, insert) are returned to the client with `{ error: error.message }` and appropriate status codes so the UI can show them and no data is lost in silent failures.

## Files involved

- **API:** `app/api/booking/route.ts` (GET by reference, POST create)
- **Form:** `app/book/BookingForm.tsx` (route/date/trip, fare type, passengers, submit; shows reference + breakdown)
- **DB:** `supabase/migrations/001_initial_schema.sql` (tables, triggers), `011_booking_inventory_reserve_on_insert` (reserve on INSERT, release on cancel/delete)
- **Types:** `lib/types/database.ts` (Booking, Trip, etc.)
