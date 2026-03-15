import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SavedTravelersForm } from "@/components/account/SavedTravelersForm";
import { AvatarUpload } from "@/components/account/AvatarUpload";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings | Travela Siargao",
  description: "Manage your profile, saved travelers, and password.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reset?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);

  const { reset } = await searchParams;

  if (reset === "1") {
    return (
      <div className="relative min-h-screen overflow-hidden">
        {/* Subtle teal wash background */}
        <div className="absolute inset-0 z-0"
          style={{ background: "linear-gradient(135deg, #E1F5EE 0%, #f0fdfa 40%, #E6F1FB 100%)" }} />
        <div className="absolute inset-0 z-0 opacity-30"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q15 10 30 30 Q45 50 60 30' stroke='%230c7b93' stroke-width='0.8' fill='none' opacity='0.3'/%3E%3C/svg%3E")`,
            backgroundSize: "60px 60px",
          }} />
        <div className="relative z-10 mx-auto max-w-md px-4 py-16 sm:px-6">
          <div className="rounded-2xl bg-white/90 border border-teal-200 shadow-xl p-8 backdrop-blur-sm">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
                <svg className="w-8 h-8 text-[#0c7b93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-[#134e4a]">Set new password</h1>
              <p className="mt-2 text-sm text-[#0f766e]">Enter your new password below.</p>
            </div>
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    );
  }

  const displayName = [user.salutation ? `${user.salutation}.` : "", user.fullName]
    .filter(Boolean).join(" ") || user.email?.split("@")[0] || "Traveler";

  // Profile completeness score
  const fields = [user.fullName, user.address, user.mobile, user.birthdate, user.gender, user.nationality];
  const filled = fields.filter(Boolean).length;
  const completeness = Math.round((filled / fields.length) * 100);

  return (
    <div className="relative min-h-screen overflow-hidden">

      {/* ── Subtle teal ocean wash background ── */}
      <div className="absolute inset-0 z-0"
        style={{ background: "linear-gradient(160deg, #C9EEE4 0%, #E1F5EE 30%, #f0fdfa 60%, #E6F1FB 100%)" }} />

      {/* Subtle wave pattern */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='40' viewBox='0 0 80 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q20 0 40 20 Q60 40 80 20' stroke='%230c7b93' stroke-width='1' fill='none'/%3E%3C/svg%3E")`,
          backgroundSize: "80px 40px",
        }} />

      {/* Top teal accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 z-10"
        style={{ background: "linear-gradient(90deg, #085C52, #0c7b93, #1AB5A3)" }} />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

        {/* ── Hero profile header ── */}
        <div className="relative overflow-hidden rounded-2xl shadow-xl mb-8"
          style={{ background: "linear-gradient(135deg, #064E44 0%, #0c7b93 50%, #1AB5A3 100%)" }}>

          {/* Animated wave overlay */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='120' height='60' viewBox='0 0 120 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 30 Q30 10 60 30 Q90 50 120 30' stroke='white' stroke-width='2' fill='none'/%3E%3Cpath d='M0 45 Q30 25 60 45 Q90 65 120 45' stroke='white' stroke-width='1.5' fill='none' opacity='0.5'/%3E%3C/svg%3E")`,
              backgroundSize: "120px 60px",
            }} />

          {/* Palm silhouette decoration */}
          <div className="absolute right-0 top-0 bottom-0 w-40 opacity-10 pointer-events-none overflow-hidden">
            <svg viewBox="0 0 160 200" className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <path d="M80 200 Q78 160 76 140 Q77 120 80 100 Q82 80 80 65" stroke="white" strokeWidth="6" fill="none" strokeLinecap="round"/>
              <path d="M80 68 Q58 45 40 50" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M80 68 Q68 38 74 20" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M80 68 Q98 42 116 48" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round"/>
              <path d="M80 68 Q94 55 108 60" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round"/>
            </svg>
          </div>

          <div className="relative px-6 py-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">

              {/* Avatar */}
              <div className="shrink-0">
                <AvatarUpload
                  currentAvatarUrl={user.avatarUrl ?? null}
                  initials={(user.fullName ?? user.email ?? "?")[0].toUpperCase()}
                />
              </div>

              {/* Name + email + role */}
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs font-bold uppercase tracking-widest text-white/50 mb-1">
                  Account Settings
                </p>
                <h1 className="text-2xl font-black text-white leading-tight">{displayName}</h1>
                <p className="text-sm text-white/70 mt-0.5">{user.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/15 border border-white/20 px-3 py-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"/>
                  <span className="text-xs font-semibold text-white capitalize">{user.role ?? "Passenger"}</span>
                </div>
              </div>

              {/* Profile completeness */}
              <div className="shrink-0 text-center">
                <div className="relative w-16 h-16">
                  <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3"/>
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="white" strokeWidth="3"
                      strokeDasharray={`${completeness} 100`} strokeLinecap="round"/>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-sm font-black text-white">{completeness}%</span>
                  </div>
                </div>
                <p className="text-xs text-white/60 mt-1">Profile</p>
              </div>
            </div>

            {/* Stats row */}
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: "Address", value: user.address ? "✓ Saved" : "Not set", ok: !!user.address },
                { label: "Mobile", value: user.mobile ? "✓ Saved" : "Not set", ok: !!user.mobile },
                { label: "Birthdate", value: user.birthdate ? "✓ Saved" : "Not set", ok: !!user.birthdate },
                { label: "Emergency", value: user.emergencyContactName ? "✓ Saved" : "Not set", ok: !!user.emergencyContactName },
              ].map((stat) => (
                <div key={stat.label}
                  className="rounded-xl bg-white/10 border border-white/20 px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{stat.label}</p>
                  <p className={`text-xs font-bold mt-0.5 ${stat.ok ? "text-emerald-300" : "text-white/35"}`}>
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Accordion sections ── */}
        <div className="space-y-3">

          <AccordionSection
            icon="👤"
            title="Personal Information"
            subtitle="Name, gender, birthdate, nationality"
            defaultOpen={!user.fullName}
            accent="teal"
          >
            <ProfileForm initialData={{
              full_name: user.fullName,
              salutation: user.salutation,
              gender: user.gender,
              birthdate: user.birthdate,
              nationality: user.nationality,
              address: user.address,
              mobile: user.mobile,
              emergency_contact_name: user.emergencyContactName,
              emergency_contact_number: user.emergencyContactNumber,
              recovery_email: user.recoveryEmail,
              email: user.email,
            }} authEmail={user.email ?? ""} />
          </AccordionSection>

          <AccordionSection
            icon="👨‍👩‍👧"
            title="Saved Travelers"
            subtitle="Family members for quick booking"
            defaultOpen={false}
            accent="blue"
          >
            <SavedTravelersForm />
          </AccordionSection>

          <AccordionSection
            icon="🔒"
            title="Security"
            subtitle="Change your password"
            defaultOpen={false}
            accent="amber"
          >
            <ChangePasswordForm />
          </AccordionSection>

        </div>

        <p className="mt-8 text-center text-xs text-[#0f766e]/50">
          Your information is used only for ferry bookings and the Coast Guard manifest.
        </p>
      </div>
    </div>
  );
}

// ── Accordion section component ───────────────────────────────────────────────
function AccordionSection({
  icon, title, subtitle, children, defaultOpen = false, accent = "teal",
}: {
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  accent?: "teal" | "blue" | "amber";
}) {
  const borders = {
    teal:  "border-teal-200 hover:border-teal-400",
    blue:  "border-blue-200 hover:border-blue-400",
    amber: "border-amber-200 hover:border-amber-400",
  }[accent];

  const icons = {
    teal:  "bg-teal-100 text-teal-700",
    blue:  "bg-blue-100 text-blue-700",
    amber: "bg-amber-100 text-amber-700",
  }[accent];

  return (
    <details
      name="account-sections"
      open={defaultOpen}
      className={`group rounded-2xl border-2 ${borders} bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden transition-all`}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none hover:bg-white/90 transition-colors">
        <div className="flex items-center gap-3">
          <span className={`text-lg w-9 h-9 rounded-xl flex items-center justify-center ${icons}`}>
            {icon}
          </span>
          <div>
            <p className="font-bold text-[#134e4a] text-sm sm:text-base">{title}</p>
            <p className="text-xs text-[#0f766e]">{subtitle}</p>
          </div>
        </div>
        <svg
          className="h-5 w-5 shrink-0 text-[#0c7b93] transition-transform duration-200 group-open:rotate-180"
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="border-t border-teal-100 px-5 py-5">
        {children}
      </div>
    </details>
  );
}
