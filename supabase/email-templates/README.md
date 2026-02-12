# Supabase Email Templates (Nier Shipping Lines)

Branded auth email templates for **Supabase Dashboard** (Authentication → Email Templates). Each template uses the same Nier Shipping Lines header, footer, and reference-number style.

---

## How to use

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard).
2. Go to **Authentication** → **Email Templates**.
3. Select the template (e.g. **Confirm signup**, **Invite user**, **Magic link**, etc.).
4. Set the **Subject** to the value in the table below.
5. Paste the full contents of the corresponding `.html` file into the **Message body** (use HTML mode if available).
6. Save.

---

## Templates and subject lines

| Dashboard template   | HTML file               | Suggested subject |
|----------------------|-------------------------|-------------------|
| **Confirm signup**   | `confirm-signup.html`   | Confirm your account – Nier Shipping Lines |
| **Invite user**      | `invite-user.html`      | You're invited – Nier Shipping Lines |
| **Magic link**      | `magic-link.html`       | Sign in to Nier Shipping Lines |
| **Change email address** | `change-email.html` | Verify your new email – Nier Shipping Lines |
| **Reset password**   | `reset-password.html`   | Reset your password – Nier Shipping Lines |
| **Reauthentication** | `reauthentication.html`| Confirm your identity – Nier Shipping Lines |

---

## What each template does

### Confirm signup
- **Use:** New users who signed up with email/password.
- **Copy:** “Confirm your account creation”, “You registered with Nier Shipping Lines using this email”.
- **Reference:** `NLR-{{ .Token }}` (registration reference).
- **CTA:** “Confirm email address”.

### Invite user
- **Use:** Inviting someone who doesn’t have an account yet.
- **Copy:** “You’re invited to join Nier Shipping Lines”, “Accept the invitation and set up your account”.
- **Reference:** `NLR-INV-{{ .Token }}`.
- **CTA:** “Accept invitation & create account”.

### Magic link
- **Use:** One-time sign-in link (passwordless).
- **Copy:** “You requested a one-time sign-in link”, “Click below to sign in”.
- **Reference:** `NLR-{{ .Token }}`.
- **CTA:** “Sign in to Nier Shipping Lines”.

### Change email address
- **Use:** Verifying a new email after the user requested a change.
- **Copy:** “You requested to change the email address for your Nier Shipping Lines account to **{{ .NewEmail }}**”.
- **Reference:** `NLR-{{ .Token }}`.
- **CTA:** “Verify new email address”.

### Reset password
- **Use:** Forgot-password flow.
- **Copy:** “We received a request to reset the password for your Nier Shipping Lines account”, “This link will expire in 1 hour”.
- **Reference:** `NLR-RESET-{{ .Token }}`.
- **CTA:** “Reset password”.

### Reauthentication
- **Use:** Sensitive actions that require re-auth (e.g. change password, delete account).
- **Copy:** “You are about to perform a sensitive action”, “We need you to confirm your identity”.
- **Reference:** `NLR-{{ .Token }}`.
- **CTA:** “Confirm identity”.

---

## Variables used (Supabase)

| Variable | Used in | Purpose |
|----------|---------|---------|
| `{{ .ConfirmationURL }}` | All | Link the user must click. |
| `{{ .Email }}` | Confirm signup, Invite, Magic link, Reset password, Reauthentication | User’s email. |
| `{{ .NewEmail }}` | Change email address | New email to verify. |
| `{{ .Token }}` | All | 6-digit OTP; shown as reference (e.g. NLR-123456). |

After updating each template in the Dashboard, the corresponding auth flow will send this branded email.
