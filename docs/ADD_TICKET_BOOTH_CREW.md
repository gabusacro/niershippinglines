# How to add a ticket booth crew in Supabase

Ticket booth crew can confirm walk-in payments, view booking history, process refunds/reschedules, and add manual bookings. They see the ticket booth dashboard (Pending payments, Booking history, Add walk-in, Reports).

## Option 1: SQL Editor (recommended)

1. The person **signs up** in your app (Sign up page) with their email and password.
2. In **Supabase Dashboard** → **SQL Editor**, run:

```sql
-- Replace 'their@email.com' with the crew member's email
UPDATE public.profiles
SET role = 'ticket_booth', approved_at = COALESCE(approved_at, NOW())
WHERE id IN (SELECT id FROM auth.users WHERE email = 'their@email.com');
```

3. They **sign out and sign back in** (or refresh the dashboard). The dashboard will show "Your role: Ticket booth" and the four work cards.

## Option 2: By user ID (if you know their UUID)

1. In **Supabase Dashboard** → **Authentication** → **Users**, find the user and copy their **UUID**.
2. In **SQL Editor**:

```sql
UPDATE public.profiles
SET role = 'ticket_booth', approved_at = COALESCE(approved_at, NOW())
WHERE id = 'paste-the-uuid-here';
```

## Option 3: Table Editor

1. **Supabase Dashboard** → **Table Editor** → **profiles**.
2. Find the row for the user (match by `email` if it’s set, or by `id` from **Authentication** → **Users**).
3. Edit the **role** column: set it to **ticket_booth**.
4. Save.

---

**Note:** The `profiles` table may not have `email` filled for every user (it can be null). Using **Option 1** with `auth.users` is the most reliable, since it matches by the email they use to log in.
