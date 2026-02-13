# Where fees and fares are set

Prices may vary over time. Here is where each value lives and how to change it.

---

## 1. Admin fee and GCash fee (code)

**Location:** `lib/constants.ts`

- **`ADMIN_FEE_CENTS_PER_PASSENGER`** — Admin fee per passenger (e.g. ₱15 = 1500 cents). Used for **all** bookings (online and walk-in).
- **`GCASH_FEE_CENTS`** — GCash fee per **transaction** (e.g. ₱15 = 1500 cents). Used only for **online/GCash** bookings; walk-in at the booth has no GCash fee (₱0).

**How to change:** Edit the numbers in `lib/constants.ts`, then redeploy. These are **not** stored in Supabase.

```ts
// Example: ₱20 per passenger, ₱15 per GCash transaction
export const ADMIN_FEE_CENTS_PER_PASSENGER = 2000;  // ₱20
export const GCASH_FEE_CENTS = 1500;                 // ₱15
```

---

## 2. Base fare and discount (Supabase)

**Location:** Supabase → **Table Editor** → **`fare_rules`**

- **`base_fare_cents`** — Base fare per adult for that route (e.g. 55000 = ₱550).
- **`discount_percent`** — Discount for senior/PWD/child (e.g. 20 = 20% off base). Infant is always free (0).
- **`route_id`** — Each row is per route (e.g. Siargao–Surigao, Dinagat–Surigao).
- **`valid_from` / `valid_until`** — Optional date range; the app uses the rule that is valid for “today.”

**How to change:** In Supabase Dashboard → Table Editor → `fare_rules`, edit the row for the route (or add a new row with a new `valid_from` for a future price change).

The **Manual Booking** form and the **Book A Trip** flow both read these from Supabase (via `/api/booking/fare?route_id=...`), so changing `fare_rules` updates the fare calculation everywhere.

---

## 3. Reschedule fee (code)

**Location:** `lib/constants.ts`

- **`RESCHEDULE_FEE_PERCENT`** — e.g. 10 = 10% of fare.
- **`RESCHEDULE_GCASH_FEE_CENTS`** — e.g. 1500 = ₱15.

Used when a passenger requests a reschedule (MARINA-style: 10% + ₱15). Edit in `lib/constants.ts` if you need to change them.

---

## Summary

| What              | Where              | How to change                    |
|-------------------|--------------------|-----------------------------------|
| Admin fee (₱/pax) | `lib/constants.ts` | Edit `ADMIN_FEE_CENTS_PER_PASSENGER` |
| GCash fee (₱)     | `lib/constants.ts` | Edit `GCASH_FEE_CENTS`            |
| Base fare, discount | Supabase `fare_rules` | Table Editor or SQL            |

The **total** shown in Manual Booking (and on Book A Trip) is:  
**base fare (from `fare_rules`) + admin fee (from constants) + GCash fee (constants; 0 for walk-in).**
