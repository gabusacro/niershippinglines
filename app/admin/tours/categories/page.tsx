import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import CategoriesClient from "./CategoriesClient";

export const metadata = {
  title: "Categories — Tours Admin",
};

export default async function TourCategoriesPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("tour_categories")
    .select("*")
    .order("sort_order", { ascending: true });

  return <CategoriesClient initialCategories={categories ?? []} />;
}