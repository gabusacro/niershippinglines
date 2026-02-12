# Supabase booking connectivity report

**Date:** 2026-02-12  
**Booking checked:** L7HHU7NCHR

---

## 1. Is the booking in Supabase? **Yes**

| Field | Value |
|-------|--------|
| Reference | L7HHU7NCHR |
| Customer email | gabu.sacro@gmail.com |
| Customer name | Marlon Matugas |
| Status | **confirmed** (payment was confirmed) |
| Total | ₱9,790 |
| Passengers | 20 |
| Created | 2026-02-12 07:30 UTC |
| Trip ID | Present (linked) |

The booking is stored correctly. The “payment required” email was sent because the row was created and the app sent the email. The booking did **not** disappear from the database.

---

## 2. What’s working (connection-wise)

| Flow | Status |
|------|--------|
| **Passenger → Create booking** | ✅ Insert works (anon/authenticated). Booking is saved. |
| **App → Send email (Resend)** | ✅ “Payment required” email is sent with reference and GCash details. |
| **Admin / Ticket booth → Confirm payment** | ✅ L7HHU7NCHR was updated to `confirmed`. UPDATE policy allows crew/admin/ticket_booth. |
| **Supabase ↔ App** | ✅ Same project (gohrllugnblfzsypapee.supabase.co). Recent bookings (last 7 days) show 11 confirmed, 4 refunded. |

So: **connection from passengers → Supabase (create booking), and from admin/ticket booth → Supabase (confirm payment), is working.** The booking is in the system.

---

## 3. Why a passenger might not “see” the booking

Visibility is controlled by **Row Level Security (RLS)**, not by the connection being down.

- **Who can read (SELECT) bookings**
  - **Staff (admin, ticket_booth, crew, captain):** can read all bookings.
  - **Passengers:** can read **only their own** bookings, and **only when logged in**:
    - Policy: **“Passengers can read own bookings by email”**
    - Role: **authenticated** only (no access for anon).
    - Rule: `auth.jwt() -> email` must match `customer_email` (after lower + trim).

So:

- The passenger **must be logged in** (same browser/session where they’re “Passenger account”).
- The **login email must match** the email on the booking: **gabu.sacro@gmail.com** (any casing is fine).

If the passenger is:

- **Not logged in,** or  
- **Logged in with another email** (e.g. different account),

then the app is **correctly** not showing that booking (RLS hides it). The data is still in Supabase; the “connection” is fine.

---

## 4. Summary

- **Connection to Supabase is working:** bookings are created, stored, and updated (e.g. L7HHU7NCHR exists and is confirmed).
- **Email notification is working:** “Payment required” is sent when the booking is created.
- **Booking L7HHU7NCHR is registered in your system** and has not disappeared from the database.
- **To see it in the app**, the passenger must be **logged in** with the **same email** used when booking: **gabu.sacro@gmail.com**. No design or code change is required for this; it’s how access is designed (passenger sees only own bookings by email).

If you want, we can next double-check the exact login email used on the passenger account vs `gabu.sacro@gmail.com` (e.g. in Supabase Auth or your app’s session).
