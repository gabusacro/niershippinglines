# Nier Shipping Lines

Booking, ticketing, and payment website for Nier Shipping Lines — Siargao ↔ Surigao, Dinagat ↔ Surigao City.

## Stack

- **Next.js** (App Router), TypeScript, Tailwind CSS
- **Supabase** (Auth, Database, Storage)
- **Vercel** (deployment)

## Setup

### 1. Clone & install

```bash
cd d:\shippinglines
npm install
```

### 2. Supabase

1. Create a project at [supabase.com](https://supabase.com) (free tier).
2. In **SQL Editor**, run the migration:  
   Copy-paste the contents of `supabase/migrations/001_initial_schema.sql` and run it.
3. In **Storage**, create a bucket named `payment-proofs` (private). Add a policy so authenticated users can upload and admins can read (see migration comments).
4. In **Project Settings → API**, copy the **Project URL** and **anon public** key.
5. (Optional) To show **tide** on the weather page, add today’s times in SQL:  
   `INSERT INTO public.tide_entries (entry_date, high_tide_time, low_tide_time) VALUES (CURRENT_DATE, '06:00', '12:00');`  
   Adjust times for your area. Admin can manage tide later.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key   # same as "publishable" / anon key in Dashboard
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-key      # for Siargao weather widget (home + /weather)
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. First admin (one-time)

**Option A — API (easiest):**

1. Sign up at [http://localhost:3000/signup](http://localhost:3000/signup) with your email and password.
2. In **Supabase Dashboard → Project Settings → API**, copy the **service_role** key (secret).
3. Add to `.env.local`: `SUPABASE_SERVICE_ROLE_KEY=your-service-role-key`
4. Restart the dev server, then open in your browser:  
   `http://localhost:3000/api/setup-admin?email=YOUR_EMAIL`  
   (e.g. `?email=gabu.sacro@gmail.com`)
5. You should see `{ "ok": true, "message": "User is now admin..." }`. Then **remove** `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and restart.

**Option B — SQL:**  
After signing up, in **SQL Editor** run:

```sql
UPDATE public.profiles SET role = 'admin', full_name = 'Admin', approved_at = NOW() WHERE id = 'YOUR-AUTH-USER-UUID';
```

Replace `YOUR-AUTH-USER-UUID` with the user's ID from **Authentication → Users**.

## Project summary

See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for full scope: boats, routes, schedule, booking, GCash proof upload, crew/captain/admin roles, attractions, weather, tide, legal pages, footer (© 2026 Gabriel Sacro).

## Deploy (Vercel)

1. Push to GitHub.
2. Import project in Vercel, add the same env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
3. Deploy.
4. **Supabase URL config (so auth works in production):**
   - In **Supabase Dashboard** go to **Authentication → URL Configuration**.
   - Set **Site URL** to your production URL (e.g. `https://your-app.vercel.app`).
   - Add **Redirect URLs**: `https://your-app.vercel.app/**` and keep `http://localhost:3000/**` if you still test locally with the same project.
   - Email confirmation and magic links will then redirect to the correct domain.
5. (Optional) In Vercel env vars, set `NEXT_PUBLIC_APP_URL=https://your-app.vercel.app` if you later add emails or links that need an absolute URL. Auth redirects use relative paths and work without this.

## Features status

See [FEATURES_STATUS.md](./FEATURES_STATUS.md) for what’s done vs missing: Schedule (live data), Book (full flow), Storage bucket, schedule_slots + trips, etc.
