import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";

export default async function CaptainPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "captain"].includes(user.role);
  if (!allowed) redirect(ROUTES.dashboard);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Captain</h1>
      <p className="mt-2 text-[#0f766e]">Board count only — coming next.</p>
    </div>
  );
}
