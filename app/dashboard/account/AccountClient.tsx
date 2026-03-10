"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AuthUser {
  id: string;
  email: string | null;
  role: string;
  fullName: string | null;
  salutation: string | null;
  mobile: string | null;
  address: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  captain: "Captain",
  crew: "Deck Crew",
  ticket_booth: "Ticket Booth",
  vessel_owner: "Vessel Owner",
  investor: "Investor",
  passenger: "Passenger",
  tour_operator: "Tour Operator",
  tour_guide: "Tour Guide",
};

const BACK_LINKS: Record<string, string> = {
  tour_guide: "/dashboard/tour-guide",
  tour_operator: "/dashboard/tour-operator",
  admin: "/admin",
  passenger: "/dashboard",
  captain: "/dashboard",
  crew: "/dashboard",
  ticket_booth: "/dashboard",
  vessel_owner: "/vessel-owner",
  investor: "/investor",
};

export default function AccountClient({ user }: { user: AuthUser }) {
  const router = useRouter();

  const [fullName, setFullName] = useState(user.fullName ?? "");
  const [salutation, setSalutation] = useState(user.salutation ?? "");
  const [mobile, setMobile] = useState(user.mobile ?? "");
  const [address, setAddress] = useState(user.address ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const backLink = BACK_LINKS[user.role] ?? "/dashboard";

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

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: "Passwords do not match" });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg({ ok: false, text: "Password must be at least 8 characters" });
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mb-6">
        <a href={backLink} className="text-sm text-emerald-600 hover:underline">
          ← Back to Dashboard
        </a>
        <h1 className="mt-3 text-2xl font-bold text-[#134e4a]">My Account</h1>
        <p className="text-sm text-gray-400 mt-1">
          {user.email} · <span className="capitalize">{ROLE_LABELS[user.role] ?? user.role}</span>
        </p>
      </div>

      {/* Profile section */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-6 mb-5">
        <h2 className="font-bold text-[#134e4a] mb-4">Profile Information</h2>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Salutation</label>
              <select
                value={salutation}
                onChange={(e) => setSalutation(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400">
                <option value="">—</option>
                <option value="Mr.">Mr.</option>
                <option value="Mrs.">Mrs.</option>
                <option value="Ms.">Ms.</option>
                <option value="Dr.">Dr.</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-gray-500 mb-1 block">Full Name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
                placeholder="Your full name"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Mobile Number</label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              placeholder="09XX XXX XXXX"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Address</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              placeholder="Your address"
            />
          </div>
        </div>

        {profileMsg && (
          <p className={"mt-3 text-sm font-semibold " + (profileMsg.ok ? "text-emerald-600" : "text-red-600")}>
            {profileMsg.ok ? "✅ " : "❌ "}{profileMsg.text}
          </p>
        )}

        <button
          onClick={handleSaveProfile}
          disabled={savingProfile}
          className="mt-4 px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">
          {savingProfile ? "Saving..." : "Save Profile"}
        </button>
      </div>

      {/* Password section */}
      <div className="rounded-2xl border-2 border-gray-100 bg-white p-6">
        <h2 className="font-bold text-[#134e4a] mb-4">Change Password</h2>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              placeholder="Enter current password"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              placeholder="Min. 8 characters"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 mb-1 block">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-emerald-400"
              placeholder="Repeat new password"
            />
          </div>
        </div>

        {passwordMsg && (
          <p className={"mt-3 text-sm font-semibold " + (passwordMsg.ok ? "text-emerald-600" : "text-red-600")}>
            {passwordMsg.ok ? "✅ " : "❌ "}{passwordMsg.text}
          </p>
        )}

        <button
          onClick={handleChangePassword}
          disabled={savingPassword}
          className="mt-4 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors">
          {savingPassword ? "Changing..." : "Change Password"}
        </button>
      </div>

    </div>
  );
}
