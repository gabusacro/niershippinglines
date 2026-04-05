import { getAllAttractionsAdmin } from "@/lib/attractions/get-attractions";
import { getAllAds } from "@/lib/attractions/get-ads";
import { AttractionsAdminPage } from "./AttractionsAdminPage";

export const metadata = {
  title: "Manage Attractions — Admin | Travela Siargao",
};

export default async function AdminAttractionsPage() {
  const [items, ads] = await Promise.all([
    getAllAttractionsAdmin(),
    getAllAds(),
  ]);
  return <AttractionsAdminPage initialItems={items} initialAds={ads} />;
}