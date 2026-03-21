// app/admin/attractions/page.tsx
// Add this to your existing admin dashboard area

import { getAllAttractionsAdmin } from "@/lib/attractions/get-attractions";
import { AttractionsAdminPage } from "./AttractionsAdminPage";

export const metadata = {
  title: "Manage Attractions — Admin | Travela Siargao",
};

export default async function AdminAttractionsPage() {
  const items = await getAllAttractionsAdmin();
  return <AttractionsAdminPage initialItems={items} />;
}
