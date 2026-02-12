# Schedule & Vessel Assignment — How It Works

## Overview

**Schedule** defines *which routes exist* and *which departure times each route operates*.  
**Vessels** use those times when you assign a boat to a route for a date range — trips are created automatically.

---

## Step 1: Schedule — Routes & Departure Times

**Admin → Schedule** (or "Schedule — Routes & departure times")

Here you:
- Edit route details (origin, destination, display name)
- **Add departure times per route** — these are the times that route operates

**Example for Vince Gabriel 1 (Surigao ↔ Siargao round-trip):**

| Route | Origin → Destination | Departure times to add |
|-------|----------------------|------------------------|
| Surigao → Siargao | Surigao City → Siargao Island | 5:30 AM (05:30), 12:00 PM (12:00) |
| Siargao → Surigao | Siargao Island → Surigao City | 8:30 AM (08:30), 11:30 AM (11:30), 4:00 PM (16:00) |

- Use **HH:MM** format (e.g. `05:30`, `11:30`, `16:00`)
- Each route has its own list of times
- When you add a time, it appears in the vessel assignment form for that route

---

## Step 2: Vessel — Assign Schedule

**Admin → Vessels → Manage vessel (e.g. Vince Gabriel 1)**

### "Vessel details & assign schedule"

1. Select **route** (e.g. "Surigao → Siargao")
2. Pick **start date** and **end date**
3. (For Dinagat routes: select port)
4. Click **Save & assign schedule**

**What happens:** For each day in the date range, one trip is created for **each departure time** defined in Schedule for that route.

**Example:** If Surigao → Siargao has 5:30 and 12:00, and you pick Feb 11–15:
- Feb 11 5:30 AM, Feb 11 12:00 PM  
- Feb 12 5:30 AM, Feb 12 12:00 PM  
- … and so on.

### "Add more trips"

Use this when the same vessel does **the return leg** on the same dates. The system allows a vessel to be on both directions of a route (e.g. Surigao→Siargao and Siargao→Surigao) in the same date range — that’s a round-trip.

**Example — Vince Gabriel 1 round-trip:**
1. Assign **Surigao → Siargao** for Feb 11–20 → creates 5:30 and 12:00 trips
2. Use **Add more trips** → select **Siargao → Surigao**, same dates Feb 11–20 → creates 8:30, 11:30, 4:00 PM trips

The vessel can now do on the same day:
- 5:30 AM: Surigao → Siargao  
- 11:30 AM: Siargao → Surigao (return)

You cannot assign the same vessel to a different route (e.g. Surigao→Dinagat) for overlapping dates.

---

## Summary

| Where | What to do |
|-------|------------|
| **Schedule** | Define routes and their departure times (5:30, 11:30, etc.) |
| **Manage vessel** | Assign a vessel to a route + date range → trips are created at those times |
| **Add more trips** | Assign the same vessel to another route (e.g. return leg) for the same dates |

**Yes** — you must add departure times in Schedule first. The vessel form only shows routes that have at least one active time.
