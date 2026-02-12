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
5. (Optional) **Tide:** For automatic Siargao tide, add `WORLD_TIDES_API_KEY` (get key at [worldtides.info](https://www.worldtides.info)). If not set, add today’s times in SQL:  
   `INSERT INTO public.tide_entries (entry_date, high_tide_time, low_tide_time) VALUES (CURRENT_DATE, '06:00', '12:00');`  
   Admin can manage tide in the dashboard.

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key   # same as "publishable" / anon key in Dashboard
NEXT_PUBLIC_OPENWEATHER_API_KEY=your-key      # for Siargao weather widget (home + /weather)
# Optional: automatic tide for Siargao (Mindanao). Get key at https://www.worldtides.info. If not set, tide uses admin-entered times.
# WORLD_TIDES_API_KEY=your-worldtides-key
```

### 4. Run locally

**In a terminal** (so you see the server and any errors):

```bash
cd d:\shippinglines
npm run dev
```

When you see `▲ Next.js ... - Local: http://localhost:3000`, open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. First admin (one-time) — no env, no special URL

1. Sign up and log in at the site.
2. On your **Dashboard** click **“Make this account the first admin (one-time Supabase step)”** (or go to `/first-admin-setup`).
3. The page shows the exact SQL with your email. Copy it.
4. Open **Supabase Dashboard → SQL Editor → New query**, paste the SQL, click **Run**.
5. Log in again. You’ll see Admin, Crew, Captain.

## Project summary

See [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md) for full scope: boats, routes, schedule, booking, GCash proof upload, crew/captain/admin roles, attractions, weather, tide, legal pages, footer (© 2026 Gabriel Sacro).

## Git remotes

- **Push to GitHub (default):** `origin` is the client repo — **jniervg/niershippinglines**. Push here from here on:
  ```bash
  git push -u origin main
  ```
  If the repo was created with a README and you need to overwrite it: `git push -u origin main --force`
- **Push to gabusacro (only when asked):** When you're told to push to gabusacro, run: `git push gabusacro main`
- **Client setup:** Clone from `https://github.com/jniervg/niershippinglines`, then create their own Supabase project and Vercel project, and set env vars there (their `NEXT_PUBLIC_SUPABASE_*`, optional `NEXT_PUBLIC_OPENWEATHER_API_KEY`, optional `WORLD_TIDES_API_KEY`). No secrets are in the repo; each deployment uses its own env in Vercel.

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
