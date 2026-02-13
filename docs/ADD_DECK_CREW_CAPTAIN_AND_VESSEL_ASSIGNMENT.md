# How to set Deck Crew / Captain and assign them to a vessel in Supabase

Deck crew and captains share the same dashboard: today’s manifest for their **assigned vessel(s)** only. The dashboard shows the current trip (by Philippines time), a dropdown of today’s trips for their vessel(s), and the passenger manifest (name, address, CP number, source).

You need to do **two things** in Supabase:

1. Set the user’s **role** to `crew` (Deck crew) or `captain` (Captain) in `profiles`.
2. **Assign** them to one or more vessels in `boat_assignments` (so they see only those vessels’ trips and manifests).

---

## 1. Set role: Deck crew or Captain

### By email (recommended)

1. The person **signs up** in your app with their email and password.
2. In **Supabase Dashboard** → **SQL Editor**, run:

```sql
-- Deck crew
UPDATE public.profiles
SET role = 'crew', approved_at = COALESCE(approved_at, NOW())
WHERE id IN (SELECT id FROM auth.users WHERE email = 'their@email.com');

-- OR Captain
UPDATE public.profiles
SET role = 'captain', approved_at = COALESCE(approved_at, NOW())
WHERE id IN (SELECT id FROM auth.users WHERE email = 'their@email.com');
```

Replace `their@email.com` with the user’s login email.

### By user ID (UUID)

1. In **Supabase Dashboard** → **Authentication** → **Users**, find the user and copy their **UUID**.
2. In **SQL Editor**:

```sql
-- Deck crew
UPDATE public.profiles
SET role = 'crew', approved_at = COALESCE(approved_at, NOW())
WHERE id = 'paste-the-uuid-here';

-- OR Captain
UPDATE public.profiles
SET role = 'captain', approved_at = COALESCE(approved_at, NOW())
WHERE id = 'paste-the-uuid-here';
```

### Using Table Editor

1. **Supabase Dashboard** → **Table Editor** → **profiles**.
2. Find the row (by `email` or by `id` from **Authentication** → **Users**).
3. Set **role** to **crew** (Deck crew) or **captain** (Captain).
4. Save.

---

## 2. Assign to a vessel (boat_assignments)

Until a user is assigned to at least one vessel, the dashboard will show: *“You have no vessel assignments. Contact admin.”*

The table `boat_assignments` links a profile to a boat with an `assignment_role`:

- `captain` — Captain for that vessel
- `deck_crew` — Deck crew for that vessel
- `ticket_booth` — Ticket booth (separate from crew/captain; not needed for manifest dashboard)

**Columns:** `boat_id`, `profile_id`, `assignment_role`. There is a unique constraint on `(boat_id, profile_id, assignment_role)`.

### By email (recommended)

1. Get the user’s profile ID and the boat ID. In **SQL Editor**:

```sql
-- List boats (copy the id of the vessel you want, e.g. Vince Gabriel 3)
SELECT id, name FROM public.boats;

-- List profile id for an email (copy the id)
SELECT id, full_name, email FROM public.profiles
WHERE id IN (SELECT id FROM auth.users WHERE email = 'their@email.com');
```

2. Insert the assignment:

```sql
-- Assign as deck_crew to one vessel (replace UUIDs)
INSERT INTO public.boat_assignments (boat_id, profile_id, assignment_role)
VALUES (
  'boat-uuid-here',   -- from boats.id
  'profile-uuid-here', -- from profiles.id
  'deck_crew'
);

-- OR assign as captain
INSERT INTO public.boat_assignments (boat_id, profile_id, assignment_role)
VALUES (
  'boat-uuid-here',
  'profile-uuid-here',
  'captain'
);
```

### One-shot by email and boat name

```sql
-- Assign user by email to vessel by name (Deck crew)
INSERT INTO public.boat_assignments (boat_id, profile_id, assignment_role)
SELECT b.id, p.id, 'deck_crew'
FROM public.boats b
CROSS JOIN public.profiles p
WHERE p.id IN (SELECT id FROM auth.users WHERE email = 'their@email.com')
  AND b.name = 'Vince Gabriel 3'
ON CONFLICT (boat_id, profile_id, assignment_role) DO NOTHING;

-- Same for Captain
INSERT INTO public.boat_assignments (boat_id, profile_id, assignment_role)
SELECT b.id, p.id, 'captain'
FROM public.boats b
CROSS JOIN public.profiles p
WHERE p.id IN (SELECT id FROM auth.users WHERE email = 'their@email.com')
  AND b.name = 'Vince Gabriel 3'
ON CONFLICT (boat_id, profile_id, assignment_role) DO NOTHING;
```

Replace `their@email.com` and `Vince Gabriel 3` with the actual email and vessel name.

### Using Table Editor

1. **Supabase Dashboard** → **Table Editor** → **boat_assignments**.
2. **Insert** → **Insert row**.
3. Set:
   - **boat_id**: choose the vessel (or paste UUID from **boats** table).
   - **profile_id**: choose the user (or paste UUID from **profiles** / **Authentication** → **Users**).
   - **assignment_role**: `deck_crew` or `captain`.
4. Save.

---

## Summary

| Step | Where | What |
|------|--------|------|
| 1 | `profiles.role` | Set to `crew` (Deck crew) or `captain` (Captain). |
| 2 | `boat_assignments` | Add row(s): `boat_id`, `profile_id`, `assignment_role` (`deck_crew` or `captain`). |

After that, the user signs out and signs back in (or refreshes). Going to **Dashboard** (or **Crew** / **Captain** which redirect to Dashboard) shows the manifest for **today’s trips** for **their assigned vessel(s)** only. The “current” trip is chosen by Philippines time; they can use the dropdown to view another trip’s manifest.

---

**Note:** The `profiles` table may not have `email` filled for every user. Matching via `auth.users` (e.g. `WHERE id IN (SELECT id FROM auth.users WHERE email = '...')`) is the most reliable when setting role or resolving profile by email.
