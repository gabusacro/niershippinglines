# Travela Siargao — Features & Readiness

**Last updated:** Feb 2025  
Use this to see what’s done, what’s missing, and what to do when you deploy.

---

## 1. Credential & auth schema (Supabase)

| Item | Status | Notes |
|------|--------|--------|
| **Supabase Auth** | ✅ In use | Email/password sign up and sign in. |
| **profiles table** | ✅ In schema | `id` = `auth.users.id`, `role`, `full_name`, `email`, `approved_at`. RLS: users read/update own; admin manages all; users can insert own (migration 003). |
| **Roles** | ✅ In schema | `app_role`: admin, captain, crew, ticket_booth, **passenger**. New signups = passenger; crew/captain assigned by admin only. |
| **First admin** | ⚠️ Manual | After first signup, run in SQL Editor: `UPDATE public.profiles SET role = 'admin', approved_at = NOW() WHERE id = 'USER-UUID';` |
| **Auth callback** | ✅ Added | `app/auth/callback/route.ts` exchanges `code` for session (email confirm / magic link). |
| **Redirect URLs** | ✅ Env-ready | App uses relative paths (`/dashboard`, `/login`). No hardcoded site URL. After deploy, set Supabase **Site URL** and **Redirect URLs** (see §5). |
| **Forgot password** | ❌ Not built | Optional later. |

---

## 2. Inventory (Supabase)

| Item | Status | Notes |
|------|--------|--------|
| **Schema** | ✅ In place | `boats`, `routes`, `fare_rules`, `schedule_slots`, `trips`, `bookings`, `booking_changes`, `refunds`. |
| **Trips inventory** | ✅ Enforced | `trips`: `online_quota`, `online_booked`, `walk_in_quota`, `walk_in_booked`. Triggers increment/decrement on booking confirm/cancel/change. |
| **Unique reference** | ✅ In DB | `generate_booking_reference()` — 10-char alphanumeric, no reuse. |
| **Seed data** | ✅ Migrations 001+002 | Routes (4), boats (7), fare_rules (₱550, 20% discount). |
| **schedule_slots** | ❌ Not seeded | No rows yet. Admin (or seed) must add departure times per route (e.g. 06:00, 12:00, 18:00). |
| **trips rows** | ❌ Not created | Trips are created from boats + schedule_slots + dates. Need admin UI or script to “generate trips” for next N days. Until then, Schedule/Book have no trips to show. |

**Summary:** Inventory logic and schema are ready. You still need to create **schedule_slots** and then **trips** (e.g. via admin or a seed) so Schedule and Book can use live data.

---

## 3. Feature-by-feature

### Sign up & Login

| Feature | Status | Notes |
|---------|--------|--------|
| Sign up page | ✅ | Email, password, full name. Creates Auth user + `profiles` row (role = **passenger**). Crew/captain assigned by admin only. |
| Login page | ✅ | Email/password → redirect to `/dashboard`. |
| Auth callback | ✅ | `/auth/callback` exchanges code for session (email confirm / magic link). |
| Dashboard | ✅ | Shows role; links to Admin / Crew / Captain by role. |
| Redirect after login | ✅ | Relative path `/dashboard`. Safe for any domain. |

### Schedule

| Feature | Status | Notes |
|---------|--------|--------|
| Schedule page | ⚠️ Static only | Shows hardcoded sample times. **Not** reading from Supabase. |
| Live schedule | ❌ | Needs: fetch `trips` (join routes, boats) by date (and optional route). Blocked until trips exist. |

### Book

| Feature | Status | Notes |
|---------|--------|--------|
| Book page (info) | ✅ | “How it works,” sample fare. |
| Booking flow | ❌ | No route/date/trip picker, no passenger form, no “create booking,” no GCash upload. |
| E-ticket (QR/PDF) | ❌ | Not built. |
| Payment proof storage | ❌ | Bucket `payment-proofs` and policies not created yet (see §4). |

### Admin / Crew / Captain

| Feature | Status | Notes |
|---------|--------|--------|
| Admin page | ⚠️ Placeholder | No boats/routes/schedule/crew UI yet. |
| Crew page | ⚠️ Placeholder | No check-in, walk-in, today’s trips. |
| Captain page | ⚠️ Placeholder | No boarded count. |

**Roadmap (Captain & reports):** Captain portal: assign captain to boat; see crew on vessel; passenger count; trip revenue; later fuel costs and profit. Reports for admin (full) and captain (their trips); trend/analytics by month. Admin can assign roles (Captain, Ticket booth, Crew) and boat assignments.

---

## 4. Supabase readiness

| Item | Status | Notes |
|------|--------|--------|
| **Migrations 001, 002, 003** | ✅ You ran them | Schema + seed + profile insert policy. |
| **RLS** | ✅ In 001 | Public read for routes, trips, boats, attractions, fare_rules, schedule_slots, tide. Admin/crew/captain policies as per PROJECT_SUMMARY. |
| **Storage bucket** | ❌ Not created | Create in Dashboard: **Storage → New bucket** → `payment-proofs`, **private**. Then add policies: authenticated upload (with naming rule), admin/crew read. |
| **Env vars** | ✅ .env.example | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Optional: `NEXT_PUBLIC_APP_URL` for production. |

---

## 5. Running locally vs after deploy (URLs)

- **In the app:** All redirects use **relative paths** (`/dashboard`, `/login`, `/auth/callback`). No hardcoded domain. Works locally and on any domain.
- **Supabase (after deploy):**  
  - **Authentication → URL Configuration**  
    - **Site URL:** `https://your-production-domain.com` (e.g. Vercel URL).  
    - **Redirect URLs:** `https://your-production-domain.com/**` (and add `http://localhost:3000/**` if you still test locally with the same project).  
  So auth redirects (email confirm, magic link, etc.) go to the correct environment.
- **Optional:** Set `NEXT_PUBLIC_APP_URL=https://your-production-domain.com` in Vercel (or your host) if we later need an absolute URL (e.g. in emails). Not required for current auth/session flow.

---

## 6. Suggested order to build next

1. **Storage:** Create `payment-proofs` bucket + policies in Supabase Dashboard.  
2. **Schedule slots + trips:** Either seed `schedule_slots` and a script/UI to create `trips` for the next 7–14 days, or build a minimal admin “Create schedule slots” and “Generate trips for date range.”  
3. **Schedule page:** Fetch trips from Supabase by date (and optional route); replace static list.  
4. **Booking flow:** Route → date → list trips → select trip → passenger details + fare type → create booking (pending_payment) → show reference → upload GCash proof to Storage (filename: `{fullname}_{date}_{reference}.ext`) → “Pending confirmation” page.  
5. **Admin:** Confirm payment (update booking to confirmed), then later boats/routes/crew.  
6. **E-ticket:** QR + PDF + reference for confirmed bookings.

---

## 7. Quick reference: what’s missing

- **Schedule:** Not connected to Supabase; no trips data yet.  
- **Book:** No real booking flow, no GCash upload, no e-ticket.  
- **Sign up / Login:** Done; add auth callback and Supabase URL config after deploy (done / documented).  
- **Credentials/schema:** Done (profiles, roles, RLS).  
- **Inventory:** Schema and triggers done; need schedule_slots + trips rows and then UI.  
- **Supabase:** Schema ready; create Storage bucket and set Site URL / Redirect URLs when you deploy.
