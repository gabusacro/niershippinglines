"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Camera, User, Lock, ChevronLeft, Shield } from "lucide-react";

interface AuthUser {
  id: string;
  email: string | null;
  role: string;
  fullName: string | null;
  salutation: string | null;
  mobile: string | null;
  address: string | null;
  avatarUrl?: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin:          "Admin",
  captain:        "Captain",
  crew:           "Deck Crew",
  ticket_booth:   "Ticket Booth",
  vessel_owner:   "Vessel Owner",
  investor:       "Investor",
  passenger:      "Passenger",
  tour_operator:  "Tour Operator",
  tour_guide:     "Tour Guide",
};

const ROLE_COLORS: Record<string, string> = {
  admin:        "bg-purple-100 text-purple-800",
  vessel_owner: "bg-teal-100 text-teal-800",
  ticket_booth: "bg-pink-100 text-pink-800",
  captain:      "bg-sky-100 text-sky-800",
  crew:         "bg-orange-100 text-orange-800",
  passenger:    "bg-blue-100 text-blue-800",
};

const BACK_LINKS: Record<string, string> = {
  tour_guide:     "/dashboard/tour-guide",
  tour_operator:  "/dashboard/tour-operator",
  admin:          "/admin",
  passenger:      "/dashboard",
  captain:        "/dashboard",
  crew:           "/dashboard",
  ticket_booth:   "/dashboard",
  vessel_owner:   "/vessel-owner",
  investor:       "/investor",
};

const inputCls = "w-full rounded-xl border-2 border-teal-100 bg-white px-3 py-2.5 text-sm text-[#134e4a] focus:outline-none focus:border-[#0c7b93] focus:ring-2 focus:ring-[#0c7b93]/20 transition-colors";
const labelCls = "text-xs font-bold text-[#134e4a] mb-1 block";

export default function AccountClient({ user }: { user: AuthUser }) {
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Avatar state ──────────────────────────────────────────────────────────
  const [avatarUrl,      setAvatarUrl]      = useState(user.avatarUrl ?? null);
  const [avatarPreview,  setAvatarPreview]  = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoMsg,       setPhotoMsg]       = useState<{ ok: boolean; text: string } | null>(null);

  // ── Profile state ─────────────────────────────────────────────────────────
  const [fullName,      setFullName]      = useState(user.fullName   ?? "");
  const [salutation,    setSalutation]    = useState(user.salutation ?? "");
  const [mobile,        setMobile]        = useState(user.mobile     ?? "");
  const [address,       setAddress]       = useState(user.address    ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState<{ ok: boolean; text: string } | null>(null);

  // ── Password state ────────────────────────────────────────────────────────
  const [currentPassword,  setCurrentPassword]  = useState("");
  const [newPassword,      setNewPassword]      = useState("");
  const [confirmPassword,  setConfirmPassword]  = useState("");
  const [savingPassword,   setSavingPassword]   = useState(false);
  const [passwordMsg,      setPasswordMsg]      = useState<{ ok: boolean; text: string } | null>(null);
  const [showCurrent,      setShowCurrent]      = useState(false);
  const [showNew,          setShowNew]          = useState(false);
  const [showConfirm,      setShowConfirm]      = useState(false);

  const backLink   = BACK_LINKS[user.role] ?? "/dashboard";
  const roleLabel  = ROLE_LABELS[user.role] ?? user.role;
  const roleCls    = ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-700";

  // ── Display name for avatar initials ─────────────────────────────────────
  const displayName = fullName.trim() || user.email?.split("@")[0] || "?";
  const initials    = displayName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

  // ── Photo upload ──────────────────────────────────────────────────────────
  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate type and size
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setPhotoMsg({ ok: false, text: "Only JPG, PNG, or WebP images are allowed." });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoMsg({ ok: false, text: "Image must be under 5MB." });
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);

    setUploadingPhoto(true);
    setPhotoMsg(null);

    try {
      const supabase  = createClient();
      const ext       = file.name.split(".").pop() ?? "jpg";
      const path      = `${user.id}/avatar.${ext}`;

      // Upload to avatars bucket — upsert so it replaces existing
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw new Error(uploadError.message);

      // Get public URL
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Add cache-busting so browser shows the new image immediately
      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Save to profile
      const res = await fetch("/api/dashboard/account/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save photo");

      setAvatarUrl(publicUrl);
      setAvatarPreview(null);
      setPhotoMsg({ ok: true, text: "Photo updated!" });
      router.refresh();
    } catch (err) {
      setAvatarPreview(null);
      setPhotoMsg({ ok: false, text: err instanceof Error ? err.message : "Upload failed" });
    } finally {
      setUploadingPhoto(false);
      // Reset file input so same file can be re-selected
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  // ── Save profile ──────────────────────────────────────────────────────────
  async function handleSaveProfile() {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const res = await fetch("/api/dashboard/account/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, salutation, mobile, address }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      setProfileMsg({ ok: true, text: "Profile updated successfully!" });
      router.refresh();
    } catch (err) {
      setProfileMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSavingProfile(false);
    }
  }

  // ── Change password ───────────────────────────────────────────────────────
  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "Passwords do not match." });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: "Password must be at least 8 characters." });
      return;
    }
    setSavingPassword(true);
    setPasswordMsg(null);
    try {
      const res = await fetch("/api/dashboard/account/change-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to change password");
      setPasswordMsg({ ok: true, text: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordMsg({ ok: false, text: err instanceof Error ? err.message : "Failed" });
    } finally {
      setSavingPassword(false);
    }
  }

  // ── Password strength indicator ───────────────────────────────────────────
  const pwStrength = newPassword.length === 0 ? 0
    : newPassword.length < 8  ? 1
    : newPassword.length < 12 ? 2
    : 3;
  const pwStrengthLabel = ["", "Weak", "Good", "Strong"][pwStrength];
  const pwStrengthColor = ["", "bg-red-400", "bg-amber-400", "bg-emerald-500"][pwStrength];

  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg, #C9EEE4 0%, #E1F5EE 40%, #f0fdfa 100%)" }}>
      <div className="h-1" style={{ background: "linear-gradient(90deg, #085C52, #0c7b93, #1AB5A3)" }} />

      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 space-y-5">

        {/* ── Back link ── */}
        <a href={backLink}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0c7b93] hover:text-[#085f72] transition-colors">
          <ChevronLeft size={16} />
          Back to Dashboard
        </a>

        {/* ── Profile Card ── */}
        <div className="rounded-2xl bg-white border-2 border-teal-100 shadow-sm overflow-hidden">

          {/* Header banner */}
          <div className="h-20 w-full" style={{ background: "linear-gradient(90deg, #085C52, #0c7b93)" }} />

          {/* Avatar + name row */}
          <div className="px-6 pb-5">
            <div className="flex items-end justify-between -mt-10 mb-4 flex-wrap gap-3">

              {/* Avatar */}
              <div className="relative">
                <div className="w-20 h-20 rounded-2xl border-4 border-white shadow-md overflow-hidden bg-teal-100 flex items-center justify-center">
                  {avatarPreview ? (
                    <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : avatarUrl ? (
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl font-black text-[#0c7b93]">{initials}</span>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>

                {/* Camera button */}
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="absolute -bottom-1 -right-1 rounded-full bg-[#0c7b93] p-1.5 text-white shadow-md hover:bg-[#085f72] transition-colors disabled:opacity-50"
                  title="Change photo">
                  <Camera size={12} />
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </div>

              {/* Role badge */}
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${roleCls}`}>
                {roleLabel}
              </span>
            </div>

            {/* Name + email */}
            <div>
              <p className="text-lg font-black text-[#134e4a]">
                {salutation && <span className="mr-1">{salutation}</span>}
                {displayName}
              </p>
              <p className="text-sm text-[#0f766e] mt-0.5">{user.email}</p>
            </div>

            {/* Photo message */}
            {photoMsg && (
              <p className={`mt-2 text-xs font-semibold ${photoMsg.ok ? "text-emerald-600" : "text-red-600"}`}>
                {photoMsg.ok ? "✅ " : "❌ "}{photoMsg.text}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              JPG, PNG or WebP · max 5MB · click the camera icon to change
            </p>
          </div>
        </div>

        {/* ── Profile Information ── */}
        <div className="rounded-2xl bg-white border-2 border-teal-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-xl bg-teal-50 p-2">
              <User size={16} className="text-[#0c7b93]" />
            </div>
            <h2 className="font-bold text-[#134e4a]">Profile Information</h2>
          </div>

          <div className="space-y-4">
            {/* Salutation + Full Name */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Salutation</label>
                <select
                  value={salutation}
                  onChange={e => setSalutation(e.target.value)}
                  className={inputCls}>
                  <option value="">—</option>
                  <option value="Mr.">Mr.</option>
                  <option value="Mrs.">Mrs.</option>
                  <option value="Ms.">Ms.</option>
                  <option value="Dr.">Dr.</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className={labelCls}>Full Name</label>
                <input
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className={inputCls}
                  placeholder="Your full name"
                />
              </div>
            </div>

            {/* Email — read only */}
            <div>
              <label className={labelCls}>
                Email Address
                <span className="ml-2 text-xs font-normal text-gray-400">(cannot be changed here)</span>
              </label>
              <input
                value={user.email ?? ""}
                readOnly
                className={`${inputCls} bg-gray-50 text-gray-400 cursor-not-allowed`}
              />
            </div>

            {/* Mobile */}
            <div>
              <label className={labelCls}>Mobile Number</label>
              <input
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                className={inputCls}
                placeholder="09XX XXX XXXX"
              />
            </div>

            {/* Address */}
            <div>
              <label className={labelCls}>Address</label>
              <input
                value={address}
                onChange={e => setAddress(e.target.value)}
                className={inputCls}
                placeholder="Your address"
              />
            </div>
          </div>

          {profileMsg && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
              profileMsg.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {profileMsg.ok ? "✅ " : "❌ "}{profileMsg.text}
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="mt-4 px-6 py-2.5 rounded-xl bg-[#0c7b93] text-white text-sm font-bold hover:bg-[#085f72] disabled:opacity-50 transition-colors">
            {savingProfile ? "Saving…" : "Save Profile"}
          </button>
        </div>

        {/* ── Change Password ── */}
        <div className="rounded-2xl bg-white border-2 border-teal-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-5">
            <div className="rounded-xl bg-teal-50 p-2">
              <Lock size={16} className="text-[#0c7b93]" />
            </div>
            <h2 className="font-bold text-[#134e4a]">Change Password</h2>
          </div>

          <div className="space-y-4">
            {/* Current password */}
            <div>
              <label className={labelCls}>Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? "text" : "password"}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className={`${inputCls} pr-16`}
                  placeholder="Enter current password"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#0c7b93] hover:text-[#085f72]">
                  {showCurrent ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className={labelCls}>New Password</label>
              <div className="relative">
                <input
                  type={showNew ? "text" : "password"}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className={`${inputCls} pr-16`}
                  placeholder="Min. 8 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#0c7b93] hover:text-[#085f72]">
                  {showNew ? "Hide" : "Show"}
                </button>
              </div>
              {/* Strength indicator */}
              {newPassword.length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map(i => (
                      <div key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                          pwStrength >= i ? pwStrengthColor : "bg-gray-200"
                        }`} />
                    ))}
                  </div>
                  <span className={`text-xs font-semibold ${
                    pwStrength === 1 ? "text-red-500"
                    : pwStrength === 2 ? "text-amber-500"
                    : "text-emerald-600"
                  }`}>
                    {pwStrengthLabel}
                  </span>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className={labelCls}>Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className={`${inputCls} pr-16 ${
                    confirmPassword && confirmPassword !== newPassword
                      ? "border-red-300 focus:border-red-400"
                      : confirmPassword && confirmPassword === newPassword
                        ? "border-emerald-300 focus:border-emerald-400"
                        : ""
                  }`}
                  placeholder="Repeat new password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#0c7b93] hover:text-[#085f72]">
                  {showConfirm ? "Hide" : "Show"}
                </button>
              </div>
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="mt-1 text-xs text-red-500 font-semibold">Passwords do not match</p>
              )}
              {confirmPassword && confirmPassword === newPassword && (
                <p className="mt-1 text-xs text-emerald-600 font-semibold">✓ Passwords match</p>
              )}
            </div>
          </div>

          {passwordMsg && (
            <div className={`mt-4 rounded-xl px-4 py-3 text-sm font-semibold ${
              passwordMsg.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              {passwordMsg.ok ? "✅ " : "❌ "}{passwordMsg.text}
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={savingPassword || !currentPassword || !newPassword || newPassword !== confirmPassword}
            className="mt-4 px-6 py-2.5 rounded-xl bg-[#0c7b93] text-white text-sm font-bold hover:bg-[#085f72] disabled:opacity-50 transition-colors">
            {savingPassword ? "Changing…" : "Change Password"}
          </button>
        </div>

        {/* ── Account Info ── */}
        <div className="rounded-2xl bg-white border-2 border-teal-100 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="rounded-xl bg-teal-50 p-2">
              <Shield size={16} className="text-[#0c7b93]" />
            </div>
            <h2 className="font-bold text-[#134e4a]">Account Details</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-teal-50">
              <span className="text-[#0f766e] font-semibold">Account ID</span>
              <span className="font-mono text-xs text-gray-400">{user.id.slice(0, 8)}…</span>
            </div>
            <div className="flex justify-between py-2 border-b border-teal-50">
              <span className="text-[#0f766e] font-semibold">Role</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${roleCls}`}>{roleLabel}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-[#0f766e] font-semibold">Email</span>
              <span className="text-[#134e4a]">{user.email}</span>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-[#0f766e]/40 pb-4">
          To change your email address, contact the admin.
        </p>
      </div>
    </div>
  );
}
