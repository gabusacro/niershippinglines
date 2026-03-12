import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SavedTravelersForm } from "@/components/account/SavedTravelersForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account Settings | Travela Siargao",
  description: "Manage your profile, saved travelers, and password.",
  robots: { index: false, follow: false }, // private page — no indexing
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reset?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);

  const { reset } = await searchParams;

  if (reset === "1") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
            <svg className="w-8 h-8 text-[#0c7b93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[#134e4a]">Set new password</h1>
          <p className="mt-2 text-sm text-[#0f766e]">
            You clicked a password reset link. Enter your new password below.
          </p>
        </div>
        <ChangePasswordForm />
      </div>
    );
  }

  const displayName = [user.salutation ? `${user.salutation}.` : "", user.fullName]
    .filter(Boolean).join(" ") || user.email?.split("@")[0] || "Traveler";

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f0fdfa] to-white">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">

        {/* ── Profile header card ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#085C52] via-[#0c7b93] to-[#1AB5A3] px-6 py-8 mb-8 shadow-lg">
          {/* Wave pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='80' height='40' viewBox='0 0 80 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q20 0 40 20 Q60 40 80 20' stroke='white' stroke-width='2' fill='none'/%3E%3C/svg%3E")`,
              backgroundSize: "80px 40px",
            }}
          />
          <div className="relative flex items-center gap-4">
            {/* Avatar */}
            <div className="shrink-0 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 border-2 border-white/30 text-2xl font-black text-white backdrop-blur-sm">
              {(user.fullName ?? user.email ?? "?")[0].toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-white/60 mb-0.5">
                Account Settings
              </p>
              <h1 className="text-xl font-black text-white leading-tight">
                {displayName}
              </h1>
              <p className="text-sm text-white/70 mt-0.5">{user.email}</p>
            </div>
          </div>

          {/* Quick stats row */}
          <div className="relative mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Address", value: user.address ? "✓ Saved" : "Not set", ok: !!user.address },
              { label: "Mobile", value: user.mobile ? "✓ Saved" : "Not set", ok: !!user.mobile },
              { label: "Birthdate", value: user.birthdate ? "✓ Saved" : "Not set", ok: !!user.birthdate },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl bg-white/10 border border-white/20 px-3 py-2 text-center backdrop-blur-sm">
                <p className="text-[10px] font-bold uppercase tracking-wider text-white/50">{stat.label}</p>
                <p className={`text-xs font-bold mt-0.5 ${stat.ok ? "text-white" : "text-white/40"}`}>
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Accordion sections ── */}
        <div className="space-y-3">
          <AccordionSection
            id="personal"
            icon="👤"
            title="Personal Information"
            subtitle="Name, gender, birthdate, nationality"
            defaultOpen={!user.fullName}
          >
            <PersonalInfoSection initialData={{
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
            id="travelers"
            icon="👨‍👩‍👧"
            title="Saved Travelers"
            subtitle="Family members for quick booking"
            defaultOpen={false}
          >
            <SavedTravelersForm />
          </AccordionSection>

          <AccordionSection
            id="security"
            icon="🔒"
            title="Security"
            subtitle="Change your password"
            defaultOpen={false}
          >
            <ChangePasswordForm />
          </AccordionSection>
        </div>

        {/* ── Footer note ── */}
        <p className="mt-8 text-center text-xs text-[#0f766e]/50">
          Your information is used only for ferry bookings and the Coast Guard manifest.
        </p>

      </div>
    </div>
  );
}

// ── Accordion wrapper (server-safe, uses CSS only) ────────────────────────────
function AccordionSection({
  id, icon, title, subtitle, children, defaultOpen = false,
}: {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      name="account-sections"
      open={defaultOpen}
      className="group rounded-2xl border-2 border-teal-200 bg-white shadow-sm overflow-hidden transition-all"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none hover:bg-teal-50/50 transition-colors">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <p className="font-semibold text-[#134e4a] text-sm sm:text-base">{title}</p>
            <p className="text-xs text-[#0f766e]">{subtitle}</p>
          </div>
        </div>
        {/* Chevron — rotates when open */}
        <svg
          className="h-5 w-5 shrink-0 text-[#0c7b93] transition-transform duration-200 group-open:rotate-180"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>

      {/* Content */}
      <div className="border-t border-teal-100 px-5 py-5">
        {children}
      </div>
    </details>
  );
}

// ── Thin wrapper that passes props to ProfileForm ─────────────────────────────
function PersonalInfoSection({ initialData, authEmail }: {
  initialData: {
    full_name: string | null;
    salutation: string | null;
    email: string | null;
    address: string | null;
    gender: string | null;
    birthdate: string | null;
    nationality: string | null;
    recovery_email: string | null;
    mobile: string | null;
    emergency_contact_name: string | null;
    emergency_contact_number: string | null;
  };
  authEmail: string;
}) {
  return <ProfileForm initialData={initialData} authEmail={authEmail} />;
}
