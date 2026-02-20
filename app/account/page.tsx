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

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Account settings</h1>
      {reset === "1" ? (
        <p className="mt-2 text-[#0f766e]">Set a new password for your account below.</p>
      ) : (
        <p className="mt-2 text-[#0f766e]">Manage your profile, email, and password.</p>
      )}

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
