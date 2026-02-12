# Supabase MCP — so the AI can run SQL directly

**Goal:** Once set up, the AI can run SQL on your Supabase project (e.g. make you admin, run migrations) without you pasting SQL or env keys.

---

## Current status

- **Supabase MCP is already in your Cursor config** (`C:\Users\Gab\.cursor\mcp.json`).
- Project: `gohrllugnblfzsypapee` (matches this app).
- When the AI tried to run SQL, it got **"Unauthorized"** — usually means the **access token is expired or invalid**.

---

## Fix it (one-time)

1. **New access token**
   - Open **https://supabase.com/dashboard/account/tokens**
   - Sign in if needed.
   - Click **Generate new token**.
   - Name it (e.g. "Cursor MCP shippinglines").
   - Copy the token (starts with `sbp_...`). You won’t see it again.

2. **Update MCP config**
   - Open **`C:\Users\Gab\.cursor\mcp.json`** in Cursor.
   - Find `"SUPABASE_ACCESS_TOKEN": "sbp_..."`.
   - Replace the value with your **new** token (keep the quotes).
   - Save the file.

3. **Restart Cursor**
   - Quit Cursor completely (File → Exit or close the app).
   - Open Cursor again and open this project.

4. **Verify**
   - In a **new chat**, ask: “Use Supabase MCP to run: SELECT 1.”
   - If it works, the AI can run SQL on your project. Then you can say e.g. “Make gabu.sacro@gmail.com admin” and the AI can run the `UPDATE` for you.

---

## After it works

- You stay as **planner** (what to build, what to change).
- The AI can act as **dev** (run SQL, apply migrations, change schema) using the MCP when you ask.
- Keep the token only in `mcp.json`; don’t paste it in chat or commit it.
