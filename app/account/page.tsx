import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { ProfileForm } from "@/components/account/ProfileForm";

export const metadata = {
  title: "Account",
  description: "Account settings - manage your profile and password",
};
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reset?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);

  const { reset } = await searchParams;

  // Clean focused UI for password reset flow
  if (reset === "1") {
    return (
      <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-teal-100 mb-4">
            <svg className="w-8 h-8 text-[#0c7b93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
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

  // Normal account settings
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Account settings</h1>
      <p className="mt-2 text-[#0f766e]">Manage your profile, email, and password.</p>

      <div className="mt-8">
        <ProfileForm
          initialData={{
            full_name: user.fullName,
            salutation: user.salutation,
            email: user.email,
            address: user.address,
            gender: user.gender,
            birthdate: user.birthdate,
            nationality: user.nationality,
            recovery_email: user.recoveryEmail,
          }}
          authEmail={user.email ?? ""}
        />
      </div>

      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
