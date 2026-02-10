# Nier Shipping Lines — Project Summary & Scope

**Last updated:** Feb 10, 2025  
**Status:** Awaiting your approval before coding.

---

## 1. Overview

- **Product:** Booking, ticketing, and payment website for **Nier Shipping Lines**.
- **Stack:** Next.js, Supabase (DB + Auth + Storage), Vercel, GitHub. All critical data in Supabase (no reliance on browser storage).
- **Routes:** Siargao ↔ Surigao | Dinagat ↔ Surigao City (7 boats total).
- **Compliance:** Philippine law–aware (PDPA-style consent, Senior/PWD discounts, provider-friendly Terms/Privacy, maritime disclaimers).
- **Infrastructure (for now):** **Supabase free tier** and **Vercel free tier.** We’ll design and implement so the app runs within these limits; you can upgrade later if needed.

---

## 2. Payment

| Item | Decision |
|------|----------|
| Method | **GCash only** for now. Manual verification. |
| Flow | Customer pays via GCash → uploads **screenshot** of payment → admin/crew verifies → booking confirmed. |
| Proof storage | **Supabase Storage.** File naming: `{customer_fullname}_{date}_{ticket_reference}.{ext}` (proper, consistent filenames). |
| Later | Enable configurable travelling cost/price; add other gateways if needed. |

---

## 3. Routes & Schedule

| Item | Decision |
|------|----------|
| Trip type | **One direction per trip.** Return = separate trip. |
| Frequency | **3–4 trips per day** per direction (design supports this; you can change times later). |
| Schedule | Admin sets departure times; **fully flexible** (you change as needed). |
| UI | Built so 3–4 trips/day per route is clear and manageable. |

---

## 4. Pricing & Passengers

| Item | Decision |
|------|----------|
| Base fare | **₱550** (configurable later; “enable travelling cost/price later” = feature to change prices). |
| Siargao vs Dinagat | Same fare for now; **pricing system ready** to differ by route later. |
| Discounts | **Senior, PWD, Child: 20%** (Philippine compliance). |
| Motorcycle | **No online motorcycle booking**; passenger-only for now. |
| Luggage | Passenger-only; no luggage/motorcycle fees in scope for now. |

---

## 5. Booking & Ticketing

| Item | Decision |
|------|----------|
| Customer choice | **Route + date + time + boat** (boat is visible/selectable). |
| Reference | **Unique alphanumeric transaction reference** (no duplicate/returning combination). |
| Ticket | **E-ticket:** QR code + PDF + reference; **hard copy** released at booth after verification. |
| Booth flow | Crew **scans QR** or **enters reference** → verification → **release physical ticket** to holder. |
| Inventory | **Strict inventory in Supabase:** every booking and walk-in affects seat count; no overbooking. |

---

## 6. Cancellation, Date Change & Refund

| Item | Decision |
|------|----------|
| Cancellation | **No cancellation.** Only **date change** allowed. |
| Date change | **20% additional fee.** App **calculates and shows** this clearly (good inventory practice). |
| Refund | **Only for:** boat engine damage or overall machine failure (e.g. move to another trip or **100% refund**). |
| Policy | Refund rules and date-change fee shown in app and in Terms. |

---

## 7. Weather & Tide

| Item | Decision |
|------|----------|
| Weather | **OpenWeather** for Siargao. API key stored in **environment variable** (e.g. `NEXT_PUBLIC_OPENWEATHER_API_KEY` or `OPENWEATHER_API_KEY`); **not** committed in code. |
| Tide | **Not specified.** Proposed: **manual/admin** (admin enters high/low tide per day or per route). API can be added later if you prefer. |

*You shared an OpenWeather key; we will use it only via env and remind you to add it in Vercel env vars.*

---

## 8. Tourist Attractions (Siargao)

| Item | Decision |
|------|----------|
| Content | **Admin-editable:** add/edit places, photos, text. |
| CTA | **“Book now”** (or equivalent) on attraction pages → links to booking flow. |

---

## 9. Legal & Compliance (Philippines)

| Item | Decision |
|------|----------|
| Consent | **PDPA-style** explicit consent for data use. |
| Terms of Service | **Generated** for you; **provider-friendly** (safe for you as operator). |
| Privacy Policy | **Generated**; aligned with Terms and data we collect. |
| Maritime / force majeure | **Generated** disclaimers (e.g. weather, sea conditions, schedule changes). |

---

## 10. Crew & Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full: boats, schedule, fares, crew approval, revenue, occupancy, attractions, legal pages, maintenance, refunds. |
| **Captain** | **Only:** see how many passengers **boarded** (from app). No booking creation, no payment. |
| **Ticket booth crew** | Create **walk-in bookings**; **mark payment received** (including for online bookings with GCash screenshot); update **walk-in passenger count**; list shows **online + walk-in** together. Can verify (QR/reference) and release ticket. |

- **Crew accounts:** Admin can **assign** (email/password or name) or crew **self-register** → **admin approves** (crew / ticket booth / captain).
- **Smooth admin UX** for managing crew and approvals.

---

## 11. Boats & Maintenance

| Item | Decision |
|------|----------|
| Total boats | **7** (all configurable). |
| Features | Set boat **running** / **maintenance**; **rename** boat; set **capacity** (e.g. 200); set **online booking quota** (e.g. 150 online, 50 walk-in). |
| Seats | **No seat numbers** for now; capacity and “available slots” only. |
| Maintenance – advertised | If a boat is on **scheduled maintenance**, **advertise on schedule** (e.g. “Boat X – Maintenance” so customers don’t book it). |
| Maintenance – emergency | **Emergency** (e.g. breakdown): move passengers to another boat **or 100% refund**. |

---

## 12. Design & Language

| Item | Decision |
|------|----------|
| Design | **Unique, authentic** (surprise you); tropical, trustworthy feel. |
| Language | **Toggle** + **multiple languages:** English, Tagalog, Spanish, UK English, German, Japanese, Korean, Chinese. |
| Implementation | Language/locale system **available** so we can add or adjust languages later. |
| **Footer** | **Copyright:** © 2026 Gabriel Sacro. All rights reserved. — **clickable** link to https://www.gabrielsacro.com/ (site-wide footer). |

---

## 13. Notifications

**What “notifications” means:** Automated messages we send to customers (and optionally crew) at key events:

| Event | Example |
|-------|--------|
| Booking confirmation | After they complete a booking (e.g. “Your trip on … is reserved. Ref: ABC123.”). |
| Reminder | E.g. 24h before departure. |
| Delay | When admin/crew marks a trip as delayed. |
| Cancellation | When a trip is cancelled (e.g. emergency/maintenance). |

**How we’ll send them:**

- **Email:** Use **Google free tier** for sending (e.g. Gmail SMTP with an App Password, or Google Workspace free if you use it). No paid email API required for now.
- **SMS:** Add later when you’re ready (e.g. Semaphore, Twilio, or a Philippine provider). Code will be structured so we can plug SMS in without redoing the notification logic.

---

## 14. Suggested Features (All Confirmed)

- **Admin dashboard:** revenue, bookings by route/boat/date, occupancy.
- **Crew dashboard:** today’s trips, check-in list, mark **departed** / **arrived**.
- **Public Schedule page:** list of departures by route/date (no login).
- **“Book now”** on attraction pages → booking flow.
- **PDPA-style consent** + Privacy + Terms pages.
- **Senior / PWD / Child** fare types (20% discount).
- **Configurable online quota** per trip (e.g. 150 online, 50 walk-in); design ready for **full online booking** with minimal walk-in later.

---

## 15. Supabase (High-Level)

- **Single source of truth:** all transactions, bookings, payments, proof filenames in Supabase (no critical data in browser storage).
- **Schema:** boats, routes, trips (route + date + time + boat), schedules, bookings (online + walk-in), payment proofs (filename = `{fullname}_{date}_{ticket_ref}`), users, crew, roles, attractions, fare rules, refunds, audit-friendly where needed.
- **Storage:** Payment screenshots in Supabase Storage with strict naming and access control.

*(Detailed schema will be created in implementation.)*

---

## 16. What You’ll Be Able to Change Later

- Fare (₱550) and different prices per route.
- Departure times and number of trips per day.
- Online vs walk-in quota per trip.
- Adding more payment methods or automation (e.g. auto-verify GCash).
- Tide: switch from manual to API if needed.

---

## 17. Open Points (Quick Confirm)

1. **Tide:** Use **manual/admin** (admin enters high/low tide) for now? Or do you want a specific tide API from the start?
2. **API key:** Confirm you’ll add the OpenWeather key in **Vercel → Project → Environment Variables** (we will never commit it).
3. **SMS:** Only email for Phase 1; SMS in a later phase is fine?

---

## 18. Next Step

Once you confirm:

- This summary is **approved**, and  
- Your answers to **§17** (tide, API key, SMS),

we will:

1. Propose the **Supabase schema** (tables, RLS, storage buckets).
2. Set up the **Next.js app** (structure, auth, env).
3. Build **incrementally**: e.g. boats + routes + schedule → booking flow → payment proof → crew/admin dashboards → attractions, weather, tide → legal pages → i18n.

**No code will be written until you say “approved” or “go” (and confirm §17).**

---

*Summary prepared for Nier Shipping Lines. All decisions above are from your answers; any oversight is mine — tell me and we’ll update this doc.*
