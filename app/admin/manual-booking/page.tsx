import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthUser } from "@/lib/auth/get-user";
import { getTripsForManualBooking } from "@/lib/admin/get-trips-for-manual-booking";
import { ManualBookingForm } from "./ManualBookingForm";
import { ROUTES } from "@/lib/constants";

export const metadata = {
  title: "Manual booking",
  description: "Add walk-in passenger to a trip — Nier Shipping Lines Admin",
};

export default async function AdminManualBookingPage() {
  const user = await getAuthUser();
  if (!user || (user.role !== "admin" && user.role !== "ticket_booth")) {
    redirect(ROUTES.dashboard);
  }

  const trips = await getTripsForManualBooking();

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#134e4a]">Manual booking</h1>
          <p className="mt-1 text-sm text-[#0f766e]">
            Add a passenger to a trip when you collect payment in person. Walk-in seats update automatically in Supabase.
          </p>
        </div>
        <Link
          href={ROUTES.admin}
          className="rounded-xl border-2 border-teal-200 px-4 py-2 text-sm font-semibold text-[#134e4a] hover:bg-teal-50"
        >
          ← Admin
        </Link>
      </div>

      <ManualBookingForm trips={trips} />
    </div>
  );
}
