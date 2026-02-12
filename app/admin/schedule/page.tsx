import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { ScheduleManager } from "./ScheduleManager";

export const metadata = {
  title: "Schedule — Routes & Times",
  description: "Manage routes (origin, destination) and departure times — Nier Shipping Lines",
};

export default async function AdminSchedulePage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[#134e4a]">Schedule — Routes & departure times</h1>
      <p className="mt-1 text-sm text-[#0f766e]">
        Each route is <strong>one direction</strong>. For each route, add <strong>only times when the boat departs from that route&apos;s origin</strong>. Example: Surigao → Siargao = only times leaving Surigao (e.g. 5:30 AM). Siargao → Surigao = only times leaving Siargao (e.g. 11:30 AM). Do not put the return time (11:30) on the outbound route (Surigao → Siargao)—the boat cannot leave Surigao at 11:30 if it left for Siargao at 5:30. When you assign a vessel to a route, trips use that route&apos;s times only.
      </p>

      <div className="mt-6">
        <ScheduleManager />
      </div>

      <div className="mt-8 flex flex-wrap gap-4">
        <Link href={ROUTES.admin} className="rounded-xl border-2 border-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-[#0c7b93] hover:bg-[#0c7b93]/10">
          ← Admin dashboard
        </Link>
        <Link href={ROUTES.adminVessels} className="rounded-xl bg-[#0c7b93] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f766e]">
          Vessels (assign trips)
        </Link>
      </div>
    </div>
  );
}
