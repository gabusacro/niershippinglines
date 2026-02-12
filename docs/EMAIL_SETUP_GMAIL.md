# Enable email notifications with Gmail

The app already sends these emails when Gmail SMTP is configured:

- **Payment required** — after a passenger creates a booking (reference, amount, GCash instructions).
- **Payment confirmed** — when an admin confirms payment (tickets ready, link to print).

You do **not** need to change any code. Add these environment variables and use a Gmail **App Password**.

---

## 1. Turn on 2-Step Verification (if needed)

1. Open [Google Account → Security](https://myaccount.google.com/security).
2. Under **How you sign in to Google**, enable **2-Step Verification** if it’s off (required for App Passwords).

---

## 2. Create a Gmail App Password

1. Go to [Google Account → Security → 2-Step Verification](https://myaccount.google.com/signinoptions/two-step-verification).
2. At the bottom, open **App passwords**.
3. Select app: **Mail**, device: **Other** (e.g. “Nier Shipping Lines”).
4. Click **Generate**. Copy the **16-character password** (no spaces).

---

## 3. Add variables to `.env.local`

In your project root, create or edit `.env.local` and add:

```env
# Gmail SMTP — booking & payment emails
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=xxxx xxxx xxxx xxxx
```

- **SMTP_USER:** The Gmail address that will send the emails (e.g. `gabu.sacro@gmail.com`).
- **SMTP_PASS:** The 16-character App Password from step 2 (you can paste it with or without spaces).

Do **not** commit `.env.local` to git (it should be in `.gitignore`).

---

## 4. Restart the dev server

After saving `.env.local`, restart Next.js so it picks up the new variables:

```bash
# Stop the server (Ctrl+C), then:
npm run dev
```

---

## 5. Verify it works

1. **Payment-required email:** Create a new booking as a passenger (use a real email you can check). You should receive “Payment required” with reference and GCash details.
2. **Payment-confirmed email:** As admin, confirm that booking. The passenger should receive “Payment confirmed – your tickets are ready”.

If nothing arrives, check:

- Spam/Junk folder.
- Server logs for `[sendViaGmail]` or `[sendBookingConfirmed]` errors.
- That 2-Step Verification is on and the App Password is correct (no normal Gmail password).

---

## Optional: Resend as fallback

If you prefer not to use Gmail, you can use [Resend](https://resend.com) instead. Set:

```env
RESEND_API_KEY=re_xxxxxxxxxxxx
RESEND_FROM=Nier Shipping Lines <your-verified@domain.com>
```

The app uses Gmail first when `SMTP_*` is set; otherwise it uses Resend when `RESEND_API_KEY` is set.
