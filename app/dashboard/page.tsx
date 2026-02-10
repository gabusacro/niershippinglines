import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { APP_NAME, ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Dashboard",
  description: `Dashboard — ${APP_NAME}`,
};

export default async function DashboardPage() {
  const user = await getAuthUser();
  if (!user) {
    redirect(ROUTES.login);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Dashboard</h1>
      <p className="mt-2 text-[#0f766e]">
        Welcome, {user.fullName || user.email || "User"}. Role: <strong>{user.role}</strong>.
      </p>
      <div className="mt-6 flex flex-wrap gap-4">
        {user.role === "admin" && (
          <Link
            href={ROUTES.admin}
            className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e] transition-colors"
          >
            Admin
          </Link>
        )}
        {(user.role === "admin" || user.role === "ticket_booth" || user.role === "crew") && (
          <Link
            href={ROUTES.crew}
            className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors"
          >
            Crew
          </Link>
        )}
        {(user.role === "admin" || user.role === "captain") && (
          <Link
            href={ROUTES.captain}
            className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10 transition-colors"
          >
            Captain
          </Link>
        )}
      </div>
    </div>
  );
}
