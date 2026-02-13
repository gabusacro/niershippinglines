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

**Push to gabusacro (your repo):**

```bash
# 1. See what changed
git status

# 2. Stage the files you edited (or all changes)
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

## 5. Quick reference: Git commands

| Goal | Command |
|------|---------|
| See changed files | `git status` |
| Stage all changes | `git add .` |
| Commit | `git commit -m "Your message"` |
| Push to GitHub | `git push origin main` |
| Pull latest from GitHub | `git pull origin main` |
| Force push (overwrite remote) | `git push --force origin main` |

If you need to run the new migration (boat_images table) on your Supabase project, apply the migration file `supabase/migrations/032_boat_images_gallery.sql` from the Supabase dashboard (SQL Editor) or via Supabase CLI.
