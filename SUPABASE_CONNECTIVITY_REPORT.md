# Supabase connectivity report — Nier Shipping Lines

**Generated:** For planning; use this to decide where to start.

---

## Summary

| Area | Connected to Supabase? | Notes |
|------|------------------------|--------|
| **Auth (login, signup, session)** | ✅ Yes | Server + browser client; env required |
| **Booking (Book a trip)** | ✅ Yes | Routes, trips, fare, create booking all use Supabase |
| **Admin dashboard (today stats)** | ✅ Yes | trips, boats, routes, bookings |
| **Admin Reports (per-vessel)** | ✅ Yes | trips, boats, bookings |
| **Admin Vessels list** | ✅ Yes | boats |
| **Admin Edit vessel** | ✅ Yes | PATCH API → boats; page loads boat + boat_assignments |
| **Schedule page** | ❌ No | Static sample data; not from DB |
| **Tide / Weather** | ✅ Partial | Tide fallback uses `tide_entries`; WorldTides API for weather |

---

## 1. Environment (required for all Supabase features)

All Supabase usage depends on:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `SUPABASE_SERVICE_ROLE_KEY` — only for `/api/setup-admin` (admin promotion by email).

**Check:** If these are missing in `.env.local`, nothing that touches Supabase will work. Start by confirming these two (or three) are set.

---

## 2. Auth — ✅ Connected

| Feature | How it uses Supabase |
|--------|------------------------|
| Login | `createClient()` (browser) → `signInWithPassword()` |
| Sign up | `createClient()` (browser) → `signUp()` + `profiles.upsert()` |
| Forgot password | `createClient()` (browser) → `resetPasswordForEmail()` |
| Session / user in app | `getAuthUser()` (server) → `auth.getUser()` + `profiles` select |
| Auth callback (email confirm, magic link) | `app/auth/callback/route.ts` → `exchangeCodeForSession()` |
| Header “Login / Sign out” | `createClient()` (browser) → `getUser()`, `onAuthStateChange()`, `signOut()` |
| First admin setup page | Uses `getAuthUser()` (Supabase) to get email; SQL is manual in Supabase SQL Editor |
| Dashboard / hasAnyAdmin | `getAuthUser()`, `hasAnyAdmin()` → `profiles` select |

**Verdict:** Auth is fully wired to Supabase. If login/signup fail, check env and Supabase Auth settings (email confirm, redirect URLs).

---

## 3. Book a trip — ✅ Connected

| Step | API / code | Supabase usage |
|------|------------|-----------------|
| Load routes | `GET /api/booking/routes` | `from("routes").select(...)` |
| Load trips for route + date | `GET /api/booking/trips?route_id=&date=` | `from("trips").select(...).eq(route_id, date).eq(status, scheduled)` + boats, routes |
| Load fare | `GET /api/booking/fare?route_id=` | `from("fare_rules").select(...)` |
| Create booking | `POST /api/booking` | `rpc("generate_booking_reference")`, `from("trips")`, `from("fare_rules")`, `from("bookings").insert()` |

**Verdict:** Booking flow is fully connected. Ensure `schedule_slots` and `trips` are seeded (and migration 009 run for Siargao/Surigao times) so “Departure time” has options.

---

## 4. Admin — ✅ Connected

| Page / action | Supabase usage |
|---------------|-----------------|
| **Dashboard** (`/admin`) | `getTodayDashboardStats()` → trips, boats, routes, bookings (today) |
| **Reports** (`/admin/reports`) | `getVesselReportsToday()` → trips, boats, bookings |
| **Vessels list** (`/admin/vessels`) | Server: `from("boats").select(...)` |
| **Edit vessel page** (`/admin/vessels/[id]`) | Server: `from("boats").select().eq(id)`, `from("boat_assignments").select().eq(boat_id)` |
| **Save vessel** (form submit) | `PATCH /api/admin/vessels/[id]` → `from("profiles")` (role check), `from("boats").update().eq(id)` |

**Verdict:** Admin edit vessel is connected: the page loads boat + assignments from Supabase, and save goes through the API to `boats` in Supabase. RLS must allow admin to update boats.

---

## 5. Schedule page — ❌ Not connected

- **File:** `app/schedule/page.tsx`
- **Current:** Renders a hardcoded `SAMPLE_SCHEDULE` (static times).
- **Gap:** Does not read `schedule_slots` or `trips` from Supabase.

**Suggested next step:** Replace static data with a server component (or API) that loads routes + `schedule_slots` (and optionally next few days’ trips) from Supabase so the public schedule matches what’s used for booking.

---

## 6. Other

| Item | Status |
|------|--------|
| **Tide** | Tide widget: WorldTides API first; fallback reads `tide_entries` from Supabase. |
| **Setup-admin API** | Uses Supabase with **service role** key; not used by first-admin flow (that one is manual SQL). |

---

## 7. Migrations to run (if not already)

These affect what the app can read/write:

| Migration | Purpose |
|------------|---------|
| `008_bookings_customer_mobile.sql` | Adds `customer_mobile` to bookings (booking form sends it). |
| `009_siargao_surigao_schedule_times.sql` | Sets Siargao ↔ Surigao departure times (5:30, 12:00 / 8:30, 16:00). |
| `007_fuel_and_boat_assignments.sql` | Adds fuel columns + `boat_assignments` (admin vessel crew assignment). |

If any of these are not applied in your Supabase project, run them in **Supabase → SQL Editor** (or via CLI).

---

## 8. Suggested order to start

1. **Env** — Confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
2. **Auth** — Log in / sign up; confirm session and dashboard role (passenger vs admin).
3. **Booking** — Open `/book`, pick route → date → departure time; create a booking; check `bookings` (and `customer_mobile` if 008 is run) in Supabase.
4. **Admin** — Log in as admin → Dashboard, Reports, Vessels list, **Edit vessel** and save; confirm changes in `boats` in Supabase.
5. **Schedule** — When ready, replace static schedule with data from `schedule_slots` (and optionally trips) so the site shows one source of truth.
6. **Migrations** — Run 007, 008, 009 if you haven’t already.

---

## 9. Quick reference: Supabase tables used

| Table | Used by |
|-------|---------|
| `profiles` | Auth, dashboard role, first-admin, hasAnyAdmin, vessel edit (assignments), setup-admin API |
| `routes` | Booking routes, admin dashboard (revenue by route) |
| `trips` | Booking trips, admin dashboard/reports, booking creation |
| `boats` | Booking (trip → boat name), admin vessels list/edit, dashboard (active count), reports |
| `bookings` | Create booking, admin dashboard/reports |
| `fare_rules` | Booking fare |
| `schedule_slots` | Not yet used by Schedule page; used when seeding/creating trips |
| `boat_assignments` | Admin vessel edit page (optional; migration 007) |
| `tide_entries` | Weather/tide widget fallback |

All of the above use the same Supabase project configured by your env vars.
