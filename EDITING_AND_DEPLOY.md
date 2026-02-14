# Editing content and deploying (Git push)

Use this guide for minor content changes (titles, descriptions, text) and for pushing code to GitHub.

---

## 1. Which file to edit for what

| What you want to change | File to open |
|-------------------------|--------------|
| **Schedule page** — title “Departure times by Route”, subtitle “Times from live schedule…” | `app/schedule/page.tsx` |
| **Schedule page** — “Good to know” bullets (arrive 30 min, schedules can change, etc.) | `app/schedule/page.tsx` |
| **Schedule page** — main heading “Ferry Schedule” and tagline | `app/schedule/page.tsx` |
| **Homepage** — hero text, tagline, main content | `app/page.tsx` |
| **Book page** — “How it works”, instructions, disclaimers | `app/book/page.tsx`, `app/book/BookingForm.tsx`, `app/book/HowItWorksSection.tsx` |
| **Terms of Service** | `app/terms/page.tsx` |
| **Privacy policy** | `app/privacy/page.tsx` |
| **Site name, tagline, routes line** (e.g. “Nier Shipping Lines”, “Siargao ↔ Surigao”) | **Supabase** → Table `site_branding` (row `id = 1`). Or Admin → Branding in the app if you have that page. |
| **Footer** links and text | `components/layout/Footer.tsx` |
| **Header** (nav links, logo text) | `components/layout/Header.tsx` |
| **Login / Sign up** — success messages, labels | `app/login/AuthForm.tsx` |
| **Weather page** | `app/weather/page.tsx` |
| **Attractions** | Data in Supabase table `attractions`; listing page in `app/attractions/` |

After editing, save the file. To see changes locally, run:

```bash
npm run dev
```

Then open the page in the browser (e.g. http://localhost:3000/schedule).

---

## 2. Pushing changes to GitHub

You may have two remotes: **origin** (e.g. jniervg/niershippinglines) and **gabusacro** (gabusacro/niershippinglines). Push to the one you have write access to.

### Step-by-step (copy each line exactly)

Run these **one at a time** in your terminal, in order. Do not skip the **dot** in `git add .`.

| Step | Command | What it does |
|------|---------|--------------|
| 1 | `git status` | See which files changed (optional but useful). |
| 2 | `git add .` | Stage **all** changes. The **dot (`.`)** means “current folder”; without it, Git says “Nothing specified, nothing added.” |
| 3 | `git commit -m "Your message"` | Save a snapshot with a short message (replace `Your message` with e.g. `Update schedule page`). |
| 4 | `git push gabusacro main` | Upload to GitHub (use `gabusacro` if that’s your remote; otherwise `origin`). |

**Why you saw “Nothing specified, nothing added”:**

- You ran `git add` **without** the dot. `git add` by itself doesn’t add anything — you must tell Git *what* to add. Use `git add .` to add everything in the current folder.

**Push to gabusacro (your repo) — full block:**

```bash
# 1. See what changed
git status

# 2. Stage ALL changes (the dot is required)
git add .

# 3. Commit with a short message
git commit -m "Your message"

# 4. Push to gabusacro (not origin)
git push gabusacro main
```

**If you only have origin and that’s your repo:**

```bash
git push origin main
```

**Why you might see “couldn't find remote ref main” or “403 Permission denied”:**

- **“couldn't find remote ref main”** — The remote branch might be named `master` or the remote has no branches yet. Use `git push gabusacro main` (or `master` if that’s the branch name). For a new empty repo, the first push creates the branch: `git push -u gabusacro main`.
- **“Permission to jniervg/niershippinglines.git denied to gabusacro”** — You’re pushing to **origin**, which points to jniervg’s repo. You don’t have write access there. Push to **your** remote instead: `git push gabusacro main`.

---

## 3. If you get a “lock” or “rejected” push

Sometimes the push is rejected because the remote has new commits (e.g. you edited on another machine or someone else pushed).

**Option A — Pull first, then push (recommended):**

```bash
git pull origin main
# Fix any merge conflicts if your editor says so, then:
git add .
git commit -m "Merge remote changes"
git push origin main
```

**Option B — Force push (use only if you are sure you want to overwrite the remote):**

⚠️ **Warning:** `git push --force` overwrites the history on GitHub with your local one. Only do this if:
- You are the only one using this repo, or
- You intentionally want to discard what’s on the remote.

```bash
git push --force origin main
```

If your host (e.g. Vercel) still shows an old version after a normal push, wait a minute for the deploy to finish or trigger a redeploy from the host’s dashboard.

---

## 4. Adding vessel photos (gallery on Schedule page)

Vessel thumbnails on the **Schedule** page (“Departure times by route”) are clickable: they open a modal with a **series of pictures** for that vessel. Photos come from Supabase.

### Where photos are stored

- **Main thumbnail** (small image next to the route): `boats.image_url` — one URL per vessel in the **boats** table.
- **Extra photos in the modal**: **boat_images** table — multiple rows per vessel, each with a URL.

So: one main image per vessel in **boats**, and as many extra images as you want in **boat_images**. The modal shows the main image first, then the rest in `sort_order`.

### How to add a photo so it goes to the right vessel

1. **Open Supabase** → your project → **Table Editor**.
2. **boats** table:
   - Find the vessel by name (e.g. “Vince Gabriel 1” or “Vince Gabriel 3”).
   - Note its **id** (UUID). You’ll need this for **boat_images**.
3. **Main thumbnail only**  
   - Edit that row in **boats** and set **image_url** to the full image URL (e.g. `https://...`).  
   - That image is used as the small picture next to the route and as the first image in the modal.
4. **Extra photos (gallery)**  
   - Open the **boat_images** table.
   - Click **Insert row**.
   - Fill in:
     - **boat_id**: paste the **id** (UUID) of the vessel from the **boats** table (e.g. VG 1 or VG 3).
     - **image_url**: full URL of the photo.
     - **sort_order**: number (0, 1, 2…) to control order in the modal (0 = first after the main image).
   - Save.

Repeat “Insert row” in **boat_images** for each extra photo; use the same **boat_id** for the same vessel (e.g. all “Vince Gabriel 1” photos get the same **boat_id**).

### Matching vessel name to boat_id

- In **boats**, the **name** column is what you see on the site (e.g. “Vince Gabriel 1”, “Vince Gabriel 3”).
- Routes like “VG 1 Siargao (Dapa) ↔ Surigao” use the vessel that’s assigned to that route in the admin; that vessel’s **name** and **id** are in **boats**.
- So: find the vessel by **name** in **boats** → copy **id** → use that **id** as **boat_id** in **boat_images**. Every photo you add with that **boat_id** will show in that vessel’s modal on the Schedule page.

---

## 5. Adding attractions and attraction photos (Attractions page)

The **Attractions** page (“Explore Siargao”) can show items from Supabase. Each attraction can have one main image and a gallery of extra photos. Clicking the thumbnail opens a modal with all photos (swipe/Previous–Next). Each card has a “Book your trip to Siargao →” link to the Book page.

### Where data is stored

- **attractions** table: `id`, `title`, `slug`, `description`, `image_url` (main thumbnail), `sort_order`, `is_published`.
- **attraction_images** table: `attraction_id`, `image_url`, `sort_order` — one row per extra photo for the gallery.

If **attractions** has no published rows, the page shows a static fallback list with icons. As soon as you add published attractions in Supabase, they appear with images and the “Book your trip to Siargao →” button.

### How to add an attraction

1. **Open Supabase** → your project → **Table Editor**.
2. Open the **attractions** table.
3. Click **Insert row**.
4. Fill in:
   - **title**: e.g. “Cloud 9”.
   - **slug**: URL-friendly id, e.g. `cloud-9` (unique).
   - **description**: Full text shown on the card.
   - **image_url**: Full URL of the main photo (used as thumbnail and first image in the modal).
   - **sort_order**: Number to order attractions (e.g. 0, 1, 2).
   - **is_published**: Set to **true** so it appears on the site.
5. Save.

### How to add extra photos (gallery modal)

1. In **attractions**, find the attraction and copy its **id** (UUID).
2. Open the **attraction_images** table.
3. Click **Insert row**.
4. Fill in:
   - **attraction_id**: paste the attraction’s **id**.
   - **image_url**: full URL of the photo.
   - **sort_order**: 0, 1, 2… to order photos in the modal (0 = first after the main image).
5. Save.

Repeat for each extra photo; use the same **attraction_id** for the same attraction. Clicking the attraction’s thumbnail on the site opens the modal with the main image first, then these in `sort_order`.

To run the **attraction_images** table migration if needed: apply `supabase/migrations/033_attraction_images_gallery.sql` in the Supabase SQL Editor or via Supabase CLI.

---

## 6. Assigning deck crew, ticket booth, and captain (manual)

User accounts get a **role** (passenger, crew, captain, ticket_booth, admin). The **dashboard and navbar change automatically** based on that role (e.g. passengers see “My bookings”, crew/captain see vessel manifests, ticket booth sees “Pending payments” and “Add walk-in”). To assign someone as deck crew, ticket booth, or captain, set their role (and for crew/captain, assign them to a vessel) in Supabase.

### Step 1: Set the user’s role (profiles table)

1. **Open Supabase** → your project → **Table Editor**.
2. Open the **profiles** table.
3. Find the user by **email** (e.g. the address they use to log in).
4. Edit that row and set **role** to one of:
   - `passenger` — Passenger Account (bookings, schedule, My bookings).
   - `crew` — Deck crew (dashboard shows vessel manifest for assigned boats).
   - `captain` — Captain (same as crew; can also post announcements for assigned vessel).
   - `ticket_booth` — Ticket booth (dashboard: Pending payments, Booking history, Add walk-in, etc.).
   - `admin` — Full admin (redirected to Admin dashboard).
5. Save.

After the next login (or refresh), their dashboard and navbar will match the new role (e.g. no “Account” in navbar for passenger/crew/captain/ticket_booth; Account appears on the dashboard).

### Step 2: Assign crew or captain to a vessel (boat_assignments)

Crew and captain only see trips and manifests for **vessels they are assigned to**. Ticket booth does **not** need a vessel assignment; they get the ticket booth dashboard for all bookings.

1. In Supabase → **Table Editor**, open the **boat_assignments** table.
2. Click **Insert row**.
3. Fill in:
   - **boat_id**: UUID of the vessel (from the **boats** table — copy the **id** of e.g. “Vince Gabriel 1” or “Vince Gabriel 3”).
   - **profile_id**: UUID of the user (from the **profiles** table — copy the **id** of the crew/captain you assigned in Step 1).
   - **assignment_role**: Choose `deck_crew` or `captain` (one row per person per boat per role).
4. Save.

Repeat for each vessel that person should see (e.g. one row per boat). The same person can be assigned to more than one boat.

### Summary

| Role           | Where to set        | Vessel assignment (boat_assignments)? | Result |
|----------------|---------------------|----------------------------------------|--------|
| Passenger      | profiles.role       | No                                     | Passenger dashboard (Book, Schedule, My bookings, Account on dashboard). |
| Deck crew      | profiles.role       | Yes — add row with assignment_role `deck_crew` | Crew dashboard: today’s trips and manifest for assigned boats. |
| Captain        | profiles.role       | Yes — add row with assignment_role `captain`   | Captain dashboard (same as crew; can post vessel announcements). |
| Ticket booth   | profiles.role       | Optional                                | Ticket booth dashboard (Pending payments, Add walk-in, Account on dashboard). |
| Admin          | profiles.role       | No                                     | Redirected to Admin; Account in navbar. |

To **remove** someone from a vessel: delete the corresponding row(s) in **boat_assignments**. To make them a passenger again: set **profiles.role** back to `passenger`.

---

## 7. Quick reference: Git commands

| Goal | Command |
|------|---------|
| See changed files | `git status` |
| Stage all changes | `git add .` ← **don’t forget the dot** |
| Commit | `git commit -m "Your message"` |
| Push to your repo | `git push gabusacro main` (or `git push origin main`) |
| Pull latest from GitHub | `git pull origin main` |
| Force push (overwrite remote) | `git push --force origin main` |

If you need to run migrations on your Supabase project, apply the SQL files from `supabase/migrations/` in the Supabase dashboard (SQL Editor) or via Supabase CLI (e.g. `032_boat_images_gallery.sql`, `033_attraction_images_gallery.sql`).

