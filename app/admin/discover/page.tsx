import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { ROUTES } from "@/lib/constants";
import { AdminDiscoverClient } from "./AdminDiscoverClient";

export const metadata = {
  title: "Discover Content — Admin",
  description: "Manage Discover Siargao content shown to passengers",
};

export default async function AdminDiscoverPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    redirect(ROUTES.dashboard);
  }

  return <AdminDiscoverClient />;
}
