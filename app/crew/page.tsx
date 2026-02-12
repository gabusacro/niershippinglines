import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";

export default async function CrewPage() {
  const user = await getAuthUser();
  if (!user) redirect(ROUTES.login);
  const allowed = ["admin", "ticket_booth", "crew", "captain"].includes(user.role ?? "");
  if (!allowed) redirect(ROUTES.dashboard);
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Crew</h1>
      <p className="mt-2 text-[#0f766e]">Today&apos;s trips, check-in, and ticket validation.</p>
      <div className="mt-6 flex flex-wrap gap-4">
        <Link
          href={ROUTES.crewScan}
          className="inline-flex items-center rounded-xl bg-[#0c7b93] px-6 py-4 font-semibold text-white hover:bg-[#0a6b7d]"
        >
          Scan ticket QR
        </Link>
      </div>
    </div>
  );
}
