import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ChangePasswordForm } from "@/components/account/ChangePasswordForm";

export const metadata = {
  title: "Account",
  description: "Account settings — change your password",
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Account</h1>
      <p className="mt-2 text-[#0f766e]">
        Manage your account. Change your password below.
      </p>
      <ChangePasswordForm />
    </div>
  );
}
