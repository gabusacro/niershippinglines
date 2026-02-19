import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getFeeSettings } from "@/lib/get-fee-settings";
import { ROUTES } from "@/lib/constants";
import { FeesForm } from "./FeesForm";

export const metadata = {
  title: "Fees & charges",
  description: "Set admin fee and GCash fee — Admin",
};

export const dynamic = "force-dynamic";

export default async function AdminFeesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect(ROUTES.dashboard);

  const settings = await getFeeSettings();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <Link href={ROUTES.admin} className="text-sm font-semibold text-[#0c7b93] hover:underline">
        ← Admin dashboard
      </Link>
      <h1 className="mt-4 text-2xl font-bold text-[#134e4a]">Fees & charges</h1>
      <p className="mt-2 text-sm text-[#0f766e]">
        Set the admin fee (per passenger) and GCash fee (per online transaction). These apply to Book a Trip and manual bookings. Base fare per route is set in Supabase <strong>fare_rules</strong> or via Schedule.
      </p>
      <FeesForm initial={settings} />
    </div>
  );
}
