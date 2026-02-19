import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";
import { SetDisplayNameForm } from "@/app/dashboard/SetDisplayNameForm";

export const metadata = {
  title: "Account",
  description: "Account settings — change your password",
};

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ reset?: string }> };

export default async function AccountPage({ searchParams }: Props) {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const { reset } = await searchParams;
  const displayName = user.fullName?.trim();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Account</h1>
      {reset === "1" ? (
        <p className="mt-2 text-[#0f766e]">
          Set a new password for your account below. You’ll use it the next time you sign in.
        </p>
      ) : (
        <p className="mt-2 text-[#0f766e]">
          Manage your account. Your profile name is linked to auth so you can be identified easily.
        </p>
      )}

      {!displayName && (
        <div className="mt-6 rounded-xl border-2 border-teal-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#134e4a]">Set your name</h2>
          <p className="mt-1 text-sm text-[#0f766e]">
            Add your name so we can identify you (synced with your auth account).
          </p>
          <SetDisplayNameForm />
        </div>
      )}

      <div className="mt-6">
        <ChangePasswordForm />
      </div>
    </div>
  );
}
